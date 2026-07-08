import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import type { Pagination } from '../dto/api-types.js';
import {} from '../lib/i18n.js';
import {} from '../middleware/i18n.middleware.js';
import { logger } from '../lib/logger.js';

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface HttpError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof Error && 'statusCode' in err && 'code' in err;
}

function httpError(
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: unknown
): HttpError {
  return Object.assign(new Error(message), { statusCode, code, details });
}

export const badRequest = (req: Request, message?: string, details?: unknown) =>
  httpError(400, ErrorCode.VALIDATION_ERROR, message ?? req.t.http.badRequest, details);

export const unauthorized = (req: Request, message?: string) =>
  httpError(401, ErrorCode.UNAUTHORIZED, message ?? req.t.http.unauthorized);

export const forbidden = (req: Request, message?: string) =>
  httpError(403, ErrorCode.FORBIDDEN, message ?? req.t.http.forbidden);

export const notFound = (req: Request, message?: string) =>
  httpError(404, ErrorCode.NOT_FOUND, message ?? req.t.http.notFound);

export const conflict = (req: Request, message?: string) =>
  httpError(409, ErrorCode.CONFLICT, message ?? req.t.http.conflict);

type AsyncHandler<TReq extends Request = Request> = (
  req: TReq,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wrap an async route handler so a thrown/rejected error reaches the error
 * middleware instead of becoming an unhandled promise rejection.
 *
 * Generic over the request type so handlers registered after `authMiddleware`
 * can be declared as `asyncHandler<AuthenticatedRequest>(...)` — resolving
 * "is the user authenticated" once, here, instead of at every `req.user`
 * access downstream. The cast is safe precisely because Express calls every
 * handler with the same mutated `req` object, so by the time a handler behind
 * `authMiddleware` runs, `req.user` is genuinely set.
 */
export const asyncHandler =
  <TReq extends Request = Request>(fn: AsyncHandler<TReq>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type PaginationQuery = z.infer<typeof PaginationSchema>;

export function buildPagination(page: number, limit: number, total: number): Pagination {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: req.t.http.notFound, statusCode: 404 });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (isHttpError(err)) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      statusCode: err.statusCode,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  logger.error('', {
    path: req.path,
    method: req.method,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: req.t.http.internalError,
    code: ErrorCode.INTERNAL_ERROR,
    statusCode: 500,
  });
}
