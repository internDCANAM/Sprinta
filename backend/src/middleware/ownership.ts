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
 * Checks that a deal belongs to the logged-in user. Reads the deal via the
 * :id param and attaches it to req.deal so the route handler doesn't need to
 * run the same query again.
 */
async function dealOwnershipLogic(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized(req));

  const id = req.params.id;
  if (typeof id !== 'string' || !id) return next(notFound(req, req.t.db.dealNotFound));

  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal) return next(notFound(req, req.t.db.dealNotFound));

  if (deal.ownerId !== req.user.userId) return next(forbidden(req));
  req.deal = deal;
  next();
}

export const dealOwnershipMiddleware = asyncHandler(dealOwnershipLogic);
