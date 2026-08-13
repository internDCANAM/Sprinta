import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { apiRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/http.js';
import type { AuthenticatedRequest } from '../utils/auth.js';
import { paginate, paginationQuerySchema, type Paginated } from '../dto/pagination.js';
import { paymentInclude, paymentSchema, type Payment } from '../dto/payment.js';

async function listPayments(req: AuthenticatedRequest): Promise<Paginated<Payment>> {
  const where = { deal: { ownerId: req.user.userId } };
  return paginate(
    paginationQuerySchema.parse(req.query),
    paymentSchema,
    () => prisma.payment.count({ where }),
    (skip, take) =>
      prisma.payment.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        skip,
        take,
        include: paymentInclude,
      })
  );
}

export const paymentsRouter = Router();
paymentsRouter.use(authMiddleware, apiRateLimiter);
paymentsRouter.get('/', asyncHandler<AuthenticatedRequest>(async (req, res) => res.json(await listPayments(req))));
