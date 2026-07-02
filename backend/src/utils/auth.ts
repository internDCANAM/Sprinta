import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { redis } from '../lib/redis.js';
import type { UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
  customerId: string | null;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

const refreshKey = (userId: string, tokenId: string) => `refresh:${userId}:${tokenId}`;

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
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
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
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
