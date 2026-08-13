import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { adminMiddleware, authMiddleware } from '../middleware/auth.js';
import { apiRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/http.js';
import { paginate, paginationQuerySchema, type Paginated } from '../dto/pagination.js';
import { adminUserRowInclude, adminUserRowSchema, type AdminUserRow } from '../dto/user.js';
import { adminDealRowInclude, adminDealRowSchema, createDealInputSchema, type AdminDealRow } from '../dto/deal.js';
import type { AuthenticatedRequest } from '../utils/auth.js';

async function listUsers(req: AuthenticatedRequest): Promise<Paginated<AdminUserRow>> {
  return paginate(
    paginationQuerySchema.parse(req.query),
    adminUserRowSchema,
    () => prisma.user.count(),
    (skip, take) =>
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: adminUserRowInclude,
      })
  );
}

async function listDeals(req: AuthenticatedRequest): Promise<Paginated<AdminDealRow>> {
  return paginate(
    paginationQuerySchema.parse(req.query),
    adminDealRowSchema,
    () => prisma.deal.count(),
    (skip, take) =>
      prisma.deal.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: adminDealRowInclude,
      })
  );
}

async function createDeal(req: AuthenticatedRequest): Promise<AdminDealRow> {
  const input = createDealInputSchema.parse(req.body);
  const deal = await prisma.deal.create({
    data: {
      ownerId: input.ownerId,
      propertyId: input.propertyId,
      externalId: input.externalId,
      title: input.title,
      dealType: input.dealType,
      status: input.status,
      estimatedGrossMinor:
        input.estimatedGrossMinor !== undefined ? BigInt(input.estimatedGrossMinor) : undefined,
      assignedToId: req.user.userId,
    },
    include: adminDealRowInclude,
  });
  return adminDealRowSchema.parse(deal);
}

export const adminRouter = Router();
adminRouter.use(authMiddleware, adminMiddleware, apiRateLimiter);
adminRouter.get('/users', asyncHandler<AuthenticatedRequest>(async (req, res) => res.json(await listUsers(req))));
adminRouter.get('/deals', asyncHandler<AuthenticatedRequest>(async (req, res) => res.json(await listDeals(req))));
adminRouter.post('/deals', asyncHandler<AuthenticatedRequest>(async (req, res) => res.status(201).json(await createDeal(req))));
