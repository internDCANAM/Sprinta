import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async.js";
import { forbidden } from "../utils/errors.js";

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware, roleMiddleware(["CUSTOMER"]));

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

paymentsRouter.get(
  "/",
  validate(PaginationSchema, "query"),
  asyncHandler(async (req, res) => {
    const customerId = req.user!.customerId;
    if (!customerId) throw forbidden();
    const { page, limit } = req.query as unknown as z.infer<typeof PaginationSchema>;

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where: { customerId } }),
      prisma.payment.findMany({
        where: { customerId },
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { deal: { select: { id: true, externalId: true, title: true } } },
      }),
    ]);

    res.json({
      data: payments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);
