import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { adminMiddleware, authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { paginate, paginationQuerySchema, type Paginated } from '../dto/pagination.js';
import { adminUserRowInclude, adminUserRowSchema, type AdminUserRow } from '../dto/user.js';
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

export const adminRouter = Router();
adminRouter.use(authMiddleware, adminMiddleware);
adminRouter.get('/users', asyncHandler<AuthenticatedRequest>(async (req, res) => res.json(await listUsers(req))));
