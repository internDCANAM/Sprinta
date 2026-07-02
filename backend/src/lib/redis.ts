import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Shared {@link Redis} client (ioredis) — used for refresh-token storage and
 * login rate-limit counters.
 *
 * `lazyConnect: false` means the connection is established immediately when this
 * module loads, not on the first command. A missing or unreachable Redis instance
 * therefore causes a startup failure rather than a mid-request error.
 *
 * `maxRetriesPerRequest` controls how many times ioredis retries a failed command
 * before rejecting the promise.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: env.REDIS_MAX_RETRIES,
  lazyConnect: false,
});

redis.on('error', (err: Error) => {
  logger.error('Redis error', { message: err.message });
});

redis.on('connect', () => {
  logger.info('Redis connected');
});
