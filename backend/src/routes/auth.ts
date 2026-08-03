import bcrypt from 'bcrypt';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { loginRateLimiter, registerRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, conflict, unauthorized } from '../utils/http.js';
import { REFRESH_COOKIE_MAX_AGE_MS, REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, isRefreshTokenValid, revokeRefreshToken, signAccessToken, signRefreshToken, storeRefreshToken, verifyRefreshToken } from '../utils/auth.js';
import { logger } from '../lib/logger.js';
import { NodeEnv } from '../config/enums.js';
import { env } from '../config/env.js';
import { resolveLocale } from '../middleware/i18n.middleware.js';
import { loginInputSchema, registerInputSchema, userProfileSchema, type LoginResponse, type RefreshResponse, type UserProfile } from '../dto/user.js';

const BCRYPT_COST = 12; // work factor — each +1 doubles hashing time

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === NodeEnv.PRODUCTION,
    sameSite: 'lax' as const,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}

/**
 * Issues a refresh token, records it as valid, and hands it to the browser.
 *
 * The token reaches the client as a `httpOnly` cookie and never as part of a
 * response body, so page scripts — including anything injected into one —
 * cannot read it back out.
 */
async function startSession(res: Response, userId: string): Promise<void> {
  const { token, tokenId } = signRefreshToken(userId);
  await storeRefreshToken(userId, tokenId);
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

async function register(req: Request): Promise<UserProfile> {
  const { password, ...profile } = registerInputSchema.parse(req.body);
  const taken = await prisma.user.findUnique({ where: { email: profile.email } });
  if (taken) throw conflict(req, req.t.input.emailTaken);
  const user = await prisma.user.create({
    data: { ...profile, passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
  });

  return userProfileSchema.parse(user);
}

/**
 * An unknown address, a deactivated account and a wrong password all fail
 * identically — a distinct message for any of them would turn the login form
 * into a way to test whether a given address has an account here.
 */
async function login(req: Request, res: Response): Promise<LoginResponse> {
  const { email, password } = loginInputSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw unauthorized(req, req.t.auth.invalidCredentials);
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized(req, req.t.auth.invalidCredentials);
  const locale = resolveLocale(req);
  await startSession(res, user.id);
  logger.info(req.t.auth.success, { userId: user.id });

  return {
    accessToken: signAccessToken({ userId: user.id, locale }),
    user: { id: user.id, locale, email: user.email, name: user.name },
  };
}

/**
 * Trades the refresh cookie for a new access token, rotating the cookie in the
 * process: the presented token is revoked as its replacement is issued, so a
 * copy lifted from one client stops working the moment the real one refreshes.
 */
async function refresh(req: Request, res: Response): Promise<RefreshResponse> {
  const token = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
  if (!token) throw unauthorized(req, req.t.auth.refreshTokenMissing);
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw unauthorized(req, req.t.auth.refreshTokenInvalid);
  }
  const valid = await isRefreshTokenValid(payload.userId, payload.tokenId);
  if (!valid) throw unauthorized(req, req.t.auth.refreshTokenRevoked);
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) throw unauthorized(req, req.t.auth.userInactive);
  await revokeRefreshToken(payload.userId, payload.tokenId);
  await startSession(res, user.id);

  return { accessToken: signAccessToken({ userId: user.id, locale: resolveLocale(req) }) };
}

async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await revokeRefreshToken(payload.userId, payload.tokenId);
    } catch { } // unverified token has nothing to revoke
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

export const authRouter = Router();
authRouter.post('/register', registerRateLimiter, asyncHandler(async (req, res) => res.status(201).json(await register(req))));
authRouter.post('/login', loginRateLimiter, asyncHandler(async (req, res) => res.json(await login(req, res))));
authRouter.post('/refresh', asyncHandler(async (req, res) => res.json(await refresh(req, res))));
authRouter.post('/logout', asyncHandler(async (req, res) => { await logout(req, res); res.status(204).end(); }));
