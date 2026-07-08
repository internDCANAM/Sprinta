import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler, buildPagination, PaginationSchema,
         forbidden, type PaginationQuery } from "../utils/http.js";
import type { AuthenticatedRequest } from "../utils/auth.js";

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware, roleMiddleware(["CUSTOMER"]));

paymentsRouter.get(
  "/",
  validate(PaginationSchema, "query"),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const customerId = req.user.customerId;
    if (!customerId) throw forbidden(req);
    const query: unknown = req.query;
    const { page, limit } = query as PaginationQuery;

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

    res.json({ data: payments, pagination: buildPagination(page, limit, total) });
  }),
);
