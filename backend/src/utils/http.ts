import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { flattenError, ZodError } from 'zod';
import { ErrorCode, type ApiErrorBody } from '../dto/error.js';
import { logger } from '../lib/logger.js';
import { invalidCsrfTokenError } from '../middleware/csrf.middleware.js';

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
    (req, res, next) => { Promise.resolve(fn(req as TReq, res, next)).catch(next); };

/**
 * The single place an {@link HttpError} becomes a response body, typed as
 * {@link ApiErrorBody} so every field the contract requires is present — drop
 * `code` here and it fails to compile, rather than reaching a client that
 * switches on it.
 */
function toErrorBody(error: HttpError): ApiErrorBody {
  return {
    error: error.message,
    code: error.code,
    statusCode: error.statusCode,
    ...(error.details !== undefined ? { details: error.details } : {}),
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  const error = notFound(req);
  res.status(error.statusCode).json(toErrorBody(error));
}

/**
 * A schema parsed inside a handler throws a raw {@link ZodError} rather than
 * an {@link HttpError}, and without this it would be reported as a 500 — the
 * client's own malformed body blamed on the server. Every inbound payload is
 * now parsed inline in its handler, so this one mapping covers every parse site.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let error: unknown = err;
  if (err instanceof ZodError) {
    error = badRequest(req, req.t.input.validationFailed, flattenError(err).fieldErrors);
  } else if (err === invalidCsrfTokenError) error = forbidden(req);
  if (isHttpError(error)) { res.status(error.statusCode).json(toErrorBody(error)); return; }

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
  } satisfies ApiErrorBody);
}
