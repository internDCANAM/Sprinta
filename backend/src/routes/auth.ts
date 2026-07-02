import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/async.js';
import { unauthorized } from '../utils/errors.js';
import { REFRESH_COOKIE_MAX_AGE_MS,REFRESH_COOKIE_NAME,isRefreshTokenValid,revokeRefreshToken,
        signAccessToken,signRefreshToken,storeRefreshToken,verifyRefreshToken } 
        from '../utils/auth.js';
import { logger } from '../lib/logger.js';
import { NodeEnv } from '../config/enums.js';
import { env } from '../config/env.js';

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
      throw unauthorized('Invalid email or password');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw unauthorized('Invalid email or password');
    }

    const customerId = user.customer?.id ?? null;
    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
      customerId,
    });

    const { token: refreshToken, tokenId } = signRefreshToken(user.id);
    await storeRefreshToken(user.id, tokenId);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    logger.info('Login successful', { userId: user.id, role: user.role });

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
    if (!token) throw unauthorized('Refresh token missing');

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw unauthorized('Invalid refresh token');
    }

    const valid = await isRefreshTokenValid(payload.userId, payload.tokenId);
    if (!valid) throw unauthorized('Refresh token revoked');

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { customer: { select: { id: true } } },
    });
    if (!user || !user.isActive) throw unauthorized('User inactive');

    await revokeRefreshToken(payload.userId, payload.tokenId);
    const { token: newRefresh, tokenId: newTokenId } = signRefreshToken(user.id);
    await storeRefreshToken(user.id, newTokenId);

    const customerId = user.customer?.id ?? null;
    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
      customerId,
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
      } catch {
      }
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    res.status(204).end();
  })
);
