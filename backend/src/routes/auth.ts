import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, unauthorized } from '../utils/http.js';
import { REFRESH_COOKIE_MAX_AGE_MS, REFRESH_COOKIE_NAME, isRefreshTokenValid, revokeRefreshToken,
         signAccessToken, signRefreshToken, storeRefreshToken,verifyRefreshToken } from '../utils/auth.js';
import { logger } from '../lib/logger.js';
import { NodeEnv } from '../config/enums.js';
import { env } from '../config/env.js';
import { extractLocale } from '../middleware/i18n.middleware.js';

export const authRouter = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === NodeEnv.PRODUCTION,
    sameSite: 'lax' as const,
    path: '/api/v1/auth',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}

authRouter.post(
  '/login',
  loginRateLimiter,
  validate(LoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof LoginSchema>;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { customer: { select: { id: true } } },
    });

    if (!user || !user.isActive) {
      throw unauthorized(req, req.t.auth.invalidCredentials);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw unauthorized(req, req.t.auth.invalidCredentials);
    }

    const customerId = user.customer?.id ?? null;
    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
      customerId,
      locale: extractLocale(req) ?? 'sv',
    });

    const { token: refreshToken, tokenId } = signRefreshToken(user.id);
    await storeRefreshToken(user.id, tokenId);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    logger.info(req.t.auth.success, { userId: user.id, role: user.role });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        customerId,
      },
    });
  })
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { customer: { select: { id: true } } },
    });
    if (!user || !user.isActive) throw unauthorized(req, req.t.auth.userInactive);

    await revokeRefreshToken(payload.userId, payload.tokenId);
    const { token: newRefresh, tokenId: newTokenId } = signRefreshToken(user.id);
    await storeRefreshToken(user.id, newTokenId);

    const customerId = user.customer?.id ?? null;
    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
      customerId,
      locale: extractLocale(req) ?? 'sv',
    });

    res.cookie(REFRESH_COOKIE_NAME, newRefresh, refreshCookieOptions());
    res.json({ accessToken });
  })
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await revokeRefreshToken(payload.userId, payload.tokenId);
      } catch {}
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    res.status(204).end();
  })
);
