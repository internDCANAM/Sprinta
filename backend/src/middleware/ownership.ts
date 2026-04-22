import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { forbidden, notFound, unauthorized } from "../utils/errors.js";

/**
 * Kontrollerar att en deal tillhör inloggad kund. Admins har alltid åtkomst.
 * Läser deal via :id-param, fäster den på req.deal så route-handler slipper
 * göra samma fråga igen.
 */
export async function dealOwnershipMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) return next(unauthorized());

  const id = req.params.id;
  if (!id) return next(notFound("Deal saknas"));

  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal) return next(notFound("Deal hittades inte"));

  if (req.user.role === "CUSTOMER") {
    if (!req.user.customerId || deal.customerId !== req.user.customerId) {
      return next(forbidden());
    }
  }

  (req as Request & { deal?: typeof deal }).deal = deal;
  next();
}
