import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async.js";
import { conflict, notFound } from "../utils/errors.js";

export const adminRouter = Router();

adminRouter.use(authMiddleware, roleMiddleware(["ADMIN", "SUPERADMIN"]));

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// ---------- customers ----------

adminRouter.get(
  "/customers",
  validate(PaginationSchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as z.infer<typeof PaginationSchema>;
    const [total, customers] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, isActive: true } },
          _count: { select: { deals: true, properties: true } },
        },
      }),
    ]);
    res.json({
      data: customers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

// ---------- deals ----------

adminRouter.get(
  "/deals",
  validate(PaginationSchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as z.infer<typeof PaginationSchema>;
    const [total, deals] = await Promise.all([
      prisma.deal.count(),
      prisma.deal.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          property: { select: { id: true, name: true } },
        },
      }),
    ]);
    res.json({
      data: deals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

const CreateDealSchema = z.object({
  customerId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  externalId: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  dealType: z.enum(["SLUTAVVERKNING", "GALLRING", "ENERGIVIRKE", "OVRIGT"]),
  status: z
    .enum(["PLANERAD", "PAGAENDE", "KLAR", "FAKTURERAD", "AVSLUTAD"])
    .default("PLANERAD"),
  estimatedGrossSek: z.number().nonnegative().optional(),
  assignedAdminId: z.string().uuid().optional(),
});

adminRouter.post(
  "/deals",
  validate(CreateDealSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof CreateDealSchema>;

    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw notFound("Kund hittades inte");

    const duplicate = await prisma.deal.findUnique({
      where: { externalId: input.externalId },
    });
    if (duplicate) throw conflict("External ID används redan");

    const deal = await prisma.deal.create({
      data: {
        customerId: input.customerId,
        propertyId: input.propertyId ?? null,
        externalId: input.externalId,
        title: input.title,
        dealType: input.dealType,
        status: input.status,
        estimatedGrossSek:
          input.estimatedGrossSek !== undefined
            ? new Prisma.Decimal(input.estimatedGrossSek)
            : null,
        assignedAdminId: input.assignedAdminId ?? req.user!.userId,
      },
    });

    res.status(201).json(deal);
  }),
);

const UpdateDealSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    status: z
      .enum(["PLANERAD", "PAGAENDE", "KLAR", "FAKTURERAD", "AVSLUTAD"])
      .optional(),
    estimatedGrossSek: z.number().nonnegative().nullable().optional(),
    finalGrossSek: z.number().nonnegative().nullable().optional(),
    assignedAdminId: z.string().uuid().nullable().optional(),
    propertyId: z.string().uuid().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Minst ett fält måste anges",
  });

adminRouter.put(
  "/deals/:id",
  validate(UpdateDealSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const input = req.body as z.infer<typeof UpdateDealSchema>;

    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing) throw notFound("Deal hittades inte");

    const data: Prisma.DealUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.status !== undefined) data.status = input.status;
    if (input.estimatedGrossSek !== undefined)
      data.estimatedGrossSek =
        input.estimatedGrossSek === null
          ? null
          : new Prisma.Decimal(input.estimatedGrossSek);
    if (input.finalGrossSek !== undefined)
      data.finalGrossSek =
        input.finalGrossSek === null ? null : new Prisma.Decimal(input.finalGrossSek);
    if (input.assignedAdminId !== undefined)
      data.assignedAdmin =
        input.assignedAdminId === null
          ? { disconnect: true }
          : { connect: { id: input.assignedAdminId } };
    if (input.propertyId !== undefined)
      data.property =
        input.propertyId === null
          ? { disconnect: true }
          : { connect: { id: input.propertyId } };

    const updated = await prisma.deal.update({ where: { id }, data });
    res.json(updated);
  }),
);

const DealEventSchema = z.object({
  eventType: z.enum([
    "AVTAL_SIGNERAT",
    "AVVERKNING_START",
    "AVVERKNING_SLUT",
    "MATBESKED",
    "UTBETALNING",
    "OVRIGT",
  ]),
  label: z.string().min(1).max(200),
  plannedDate: z.coerce.date().optional(),
  actualDate: z.coerce.date().optional(),
  note: z.string().max(2000).optional(),
});

adminRouter.post(
  "/deals/:id/events",
  validate(DealEventSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id!;
    const deal = await prisma.deal.findUnique({ where: { id } });
    if (!deal) throw notFound("Deal hittades inte");

    const input = req.body as z.infer<typeof DealEventSchema>;
    const event = await prisma.dealEvent.create({
      data: {
        dealId: id,
        eventType: input.eventType,
        label: input.label,
        plannedDate: input.plannedDate ?? null,
        actualDate: input.actualDate ?? null,
        note: input.note ?? null,
        createdBy: req.user!.userId,
      },
    });
    res.status(201).json(event);
  }),
);
