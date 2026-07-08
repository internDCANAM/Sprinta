import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { forbidden, notFound, unauthorized, asyncHandler } from '../utils/http.js';
import type { AuthenticatedRequest } from '../utils/auth.js';
import type { Deal } from '../../prisma/generated/prisma/client.js';

/**
 * A request that has already passed `dealOwnershipMiddleware`, which attaches
 * the fetched deal to `req.deal` before calling `next()`. Route handlers
 * registered after it declare their `req` parameter as this type (via
 * `asyncHandler<DealRequest>`) so `req.deal` reads as guaranteed — matching
 * the runtime guarantee — instead of being narrowed by hand at every access.
 */
export interface DealRequest extends AuthenticatedRequest {
  deal: Deal;
}

/**
 * Checks that a deal belongs to the logged-in customer. Reads the deal via the
 * :id param and attaches it to req.deal so the route handler doesn't need to
 * run the same query again.
 */
// 1. Write the logic normally (not exported yet)
async function dealOwnershipLogic(req: Request, _res: Response, next: NextFunction) {
  // No need for strict Promise<void> return type here
  if (!req.user) return next(unauthorized(req));

  const id = req.params.id;
  if (!id) return next(notFound(req, req.t.db.dealNotFound));

  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal) return next(notFound(req, req.t.db.dealNotFound));

  if (req.user.role === 'CUSTOMER') {
    if (!req.user.customerId || deal.customerId !== req.user.customerId) {
      return next(forbidden(req));
    }
  }

  req.deal = deal;
  next();
}

export const dealOwnershipMiddleware = asyncHandler(dealOwnershipLogic);
