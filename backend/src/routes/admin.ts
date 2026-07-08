import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, buildPagination, PaginationSchema, type PaginationQuery } from '../utils/http.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware, roleMiddleware(['ADMIN', 'SUPERADMIN']));

// TODO: actually decide what an admin can and can't do. the original vibe-code
//       let admin control deals freely, fake a deal's status/missclick it
//       without confirmation/checks. deals should be 'handshakes' between two
//       people only and certainly not set by a third-party.

adminRouter.get(
  '/customers',
  validate(PaginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const query: unknown = req.query;
    const { page, limit } = query as PaginationQuery;
    const [total, customers] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, isActive: true } },
          _count: { select: { deals: true, properties: true } },
        },
      }),
    ]);
    res.json({ data: customers, pagination: buildPagination(page, limit, total) });
  })
);

adminRouter.get(
  '/deals',
  validate(PaginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const query: unknown = req.query;
    const { page, limit } = query as PaginationQuery;
    const [total, deals] = await Promise.all([
      prisma.deal.count(),
      prisma.deal.findMany({
        orderBy: { createdAt: 'desc' },
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
    res.json({ data: deals, pagination: buildPagination(page, limit, total) });
  })
);
