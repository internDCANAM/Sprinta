import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { redis } from '../lib/redis.js';
import { UserRole } from '../../prisma/generated/prisma/client.js';
import { languages, type Locale } from '../lib/i18n.js';

const localeValues = Object.keys(languages) as [Locale, ...Locale[]];

const AccessTokenPayloadSchema = z.object({
  userId: z.string(),
  role: z.nativeEnum(UserRole),
  customerId: z.string().nullable(),
  locale: z.enum(localeValues),
});

/**
 * Shape of a verified access token's payload. Derived from
 * {@link AccessTokenPayloadSchema} rather than hand-written, so the runtime
 * check and the compile-time type can never drift apart.
 */
export type AccessTokenPayload = z.infer<typeof AccessTokenPayloadSchema>;

/**
 * A request that has already passed `authMiddleware`, which populates
 * `req.user` before calling `next()`. Route handlers registered after
 * `authMiddleware` declare their `req` parameter as this type (via
 * `asyncHandler<AuthenticatedRequest>`) so `req.user` reads as guaranteed —
 * matching the runtime guarantee — instead of narrowing it by hand at
 * every access.
 */
export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

const RefreshTokenPayloadSchema = z.object({
  userId: z.string(),
  tokenId: z.string(),
});

export type RefreshTokenPayload = z.infer<typeof RefreshTokenPayloadSchema>;

const refreshKey = (userId: string, tokenId: string) => `refresh:${userId}:${tokenId}`;

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  return AccessTokenPayloadSchema.parse(decoded);
}

export function signRefreshToken(userId: string): {
  token: string;
  tokenId: string;
} {
  const tokenId = randomBytes(16).toString('hex');
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'],
  };
  const token = jwt.sign({ userId, tokenId }, env.JWT_REFRESH_SECRET, options);
  return { token, tokenId };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  return RefreshTokenPayloadSchema.parse(decoded);
}

// 30-day TTL matches the refresh token lifetime configured in JWT_REFRESH_TTL
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function storeRefreshToken(userId: string, tokenId: string): Promise<void> {
  await redis.set(refreshKey(userId, tokenId), '1', 'EX', REFRESH_TTL_SECONDS);
}

export async function isRefreshTokenValid(userId: string, tokenId: string): Promise<boolean> {
  const result = await redis.get(refreshKey(userId, tokenId));
  return result === '1';
}

export async function revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
  await redis.del(refreshKey(userId, tokenId));
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  const stream = redis.scanStream({ match: `refresh:${userId}:*`, count: 100 });
  for await (const keys of stream as AsyncIterable<string[]>) {
    if (keys.length) {
      await redis.del(...keys);
    }
  }
}

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_TTL_SECONDS * 1000;
