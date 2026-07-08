import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../../prisma/generated/prisma/client.js';
import { verifyAccessToken } from '../utils/auth.js';
import { forbidden, unauthorized } from '../utils/http.js';
import { createTranslator } from '../lib/i18n.js';
import { extractLocale } from './i18n.middleware.js';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.get('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return next(unauthorized(req));
  }
  const token = header.slice(7).trim();
  try {
    req.user = verifyAccessToken(token);
    // The global i18n middleware ran before req.user existed, so req.t was
    // built without it. Now that the user's stored locale is available,
    // re-derive req.t so authenticated responses honor it.
    req.t = createTranslator(extractLocale(req) ?? 'sv');
    next();
  } catch {
    next(unauthorized(req, req.t.auth.unauthorized));
  }
}

export function roleMiddleware(allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized(req));
    if (!allowed.includes(req.user.role)) return next(forbidden(req));
    next();
  };
}
