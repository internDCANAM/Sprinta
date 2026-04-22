import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { dealOwnershipMiddleware } from "../middleware/ownership.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async.js";
import { forbidden, notFound } from "../utils/errors.js";

export const dealsRouter = Router();

dealsRouter.use(authMiddleware, roleMiddleware(["CUSTOMER"]));

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

dealsRouter.get(
  "/",
  validate(PaginationSchema, "query"),
  asyncHandler(async (req, res) => {
    const customerId = req.user!.customerId;
    if (!customerId) throw forbidden();
    const { page, limit } = req.query as unknown as z.infer<typeof PaginationSchema>;

    const [total, deals] = await Promise.all([
      prisma.deal.count({ where: { customerId } }),
      prisma.deal.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          property: { select: { id: true, name: true } },
          _count: { select: { events: true, timberPosts: true } },
        },
      }),
    ]);

    res.json({
      data: deals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

dealsRouter.get(
  "/:id",
  dealOwnershipMiddleware,
  asyncHandler(async (req, res) => {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        property: true,
        _count: {
          select: {
            events: true,
            timberPosts: true,
            costs: true,
            documents: true,
            messages: true,
          },
        },
      },
    });
    if (!deal) throw notFound();
    res.json(deal);
  }),
);

dealsRouter.get(
  "/:id/events",
  dealOwnershipMiddleware,
  asyncHandler(async (req, res) => {
    const events = await prisma.dealEvent.findMany({
      where: { dealId: req.params.id },
      orderBy: [
        { actualDate: { sort: "asc", nulls: "last" } },
        { plannedDate: { sort: "asc", nulls: "last" } },
        { createdAt: "asc" },
      ],
    });
    res.json({ data: events });
  }),
);

dealsRouter.get(
  "/:id/timber",
  dealOwnershipMiddleware,
  asyncHandler(async (req, res) => {
    const posts = await prisma.timberPost.findMany({
      where: { dealId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    res.json({ data: posts });
  }),
);

dealsRouter.get(
  "/:id/costs",
  dealOwnershipMiddleware,
  asyncHandler(async (req, res) => {
    const costs = await prisma.dealCost.findMany({
      where: { dealId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    res.json({ data: costs });
  }),
);

dealsRouter.get(
  "/:id/documents",
  dealOwnershipMiddleware,
  asyncHandler(async (req, res) => {
    const docs = await prisma.document.findMany({
      where: { dealId: req.params.id },
      select: {
        id: true,
        docType: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: docs });
  }),
);

dealsRouter.get(
  "/:id/messages",
  dealOwnershipMiddleware,
  asyncHandler(async (req, res) => {
    const messages = await prisma.message.findMany({
      where: { dealId: req.params.id },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });
    res.json({ data: messages });
  }),
);

const MessageSchema = z.object({
  body: z.string().min(1).max(5000),
});

dealsRouter.post(
  "/:id/messages",
  dealOwnershipMiddleware,
  validate(MessageSchema),
  asyncHandler(async (req, res) => {
    const { body } = req.body as z.infer<typeof MessageSchema>;
    const message = await prisma.message.create({
      data: {
        dealId: req.params.id!,
        senderId: req.user!.userId,
        senderRole: req.user!.role === "CUSTOMER" ? "CUSTOMER" : "ADMIN",
        body,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    res.status(201).json(message);
  }),
);
