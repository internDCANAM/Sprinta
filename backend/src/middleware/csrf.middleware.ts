import type { Request, Response } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { env } from '../config/env.js';
import { NodeEnv } from '../config/enums.js';
import { REFRESH_COOKIE_MAX_AGE_MS, REFRESH_COOKIE_NAME } from '../utils/auth.js';

export const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * Double-submit CSRF protection for the two auth routes that rely on an
 * ambient cookie (`/auth/refresh`, `/auth/logout`) rather than the
 * `Authorization` header every other route requires. The token is bound to
 * the refresh cookie's current value, so a token minted for one session
 * can't be replayed against another — see {@link REFRESH_COOKIE_NAME}'s
 * rotation in `startSession`.
 */
export const { doubleCsrfProtection, generateCsrfToken, invalidCsrfTokenError } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: (req) => (req.cookies[REFRESH_COOKIE_NAME] as string | undefined) ?? '',
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: {
    httpOnly: false,
    secure: env.NODE_ENV === NodeEnv.PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  },
});

/**
 * (Re)mints the CSRF cookie for a freshly issued refresh token.
 *
 * {@link generateCsrfToken} binds its output to `getSessionIdentifier`'s read
 * of `req.cookies`, but `res.cookie` only queues a value for the outgoing
 * response — `req.cookies` still holds the token being replaced. Patching it
 * here first makes generation see the same value validation will see on the
 * next call.
 */
export function issueCsrfToken(req: Request, res: Response, refreshToken: string): void {
  req.cookies[REFRESH_COOKIE_NAME] = refreshToken;
  generateCsrfToken(req, res, { overwrite: true });
}
