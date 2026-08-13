import type { Request } from 'express';
import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../lib/redis.js';
import { SecurityEventSeverity } from '../../prisma/generated/prisma/enums.js';
import { ErrorCode } from '../dto/error.js';
import { recordSecurityEvent, SecurityEventType } from '../utils/securityEvents.js';
import type { AuthenticatedRequest } from '../utils/auth.js';

/**
 * Cookie-authenticated routes run before req.user exists and can only key on
 * the address. Everything behind authMiddleware keys on the user, so one
 * customer cannot spend the budget of everyone sharing their connection.
 */
export const RateLimitKey = {
  IP: 'ip',
  USER: 'user',
} as const;

export type RateLimitKey = (typeof RateLimitKey)[keyof typeof RateLimitKey];

interface RateLimitConfig {
  prefix: string;               // Redis key namespace, one counter per endpoint
  windowMs: number;             // how far back the counter looks
  limit: number;                // requests allowed per window, per key
  key: RateLimitKey;            // what the counter is keyed on 
  eventType: SecurityEventType; // recorded on the security event when the limit trips
  message: string;              // audit-log text not shown to the client
}

function keyGenerator(key: RateLimitKey): (req: Request) => string {
  switch (key) {
    case RateLimitKey.IP:
      return (req) => ipKeyGenerator(req.ip ?? '');
    case RateLimitKey.USER:
      return (req) => (req as AuthenticatedRequest).user.userId;
  }
}

/**
 * counters live in Redis so they survive a restart and hold across every
 * instance. an in-memory limiter would reset on deploy and count each
 * process separately, which is most of the protection gone.
 */
function redisRateLimiter(config: RateLimitConfig): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: keyGenerator(config.key),

    store: new RedisStore({
      sendCommand: (command: string, ...args: string[]) =>
        redis.call(command, ...args) as Promise<never>,
      prefix: config.prefix,
    }),

    handler: (req, res) => {
      void recordSecurityEvent({
        req,
        eventType: config.eventType,
        severity: SecurityEventSeverity.HIGH,
        message: config.message,
        metadata: { control: 'ISO27001_A.8.15_A.8.16' },
      });

      res.status(429).json({
        error: req.t.http.rateLimited,
        code: ErrorCode.RATE_LIMITED,
        statusCode: 429,
      });
    },
  });
}

export const loginRateLimiter = redisRateLimiter({
  prefix: 'rl:login:',
  windowMs: 60 * 1000,
  limit: 10,
  key: RateLimitKey.IP,
  eventType: SecurityEventType.LOGIN_RATE_LIMIT_EXCEEDED,
  message: 'Login rate limit exceeded',
});

/**
 * Far tighter than login: a real person registers once, so anything past a
 * handful an hour from one address is scripted. Each attempt also costs a
 * bcrypt hash, which makes an unthrottled endpoint a cheap way to burn CPU.
 */
export const registerRateLimiter = redisRateLimiter({
  prefix: 'rl:register:',
  windowMs: 60 * 60 * 1000,
  limit: 5,
  key: RateLimitKey.IP,
  eventType: SecurityEventType.REGISTER_RATE_LIMIT_EXCEEDED,
  message: 'Registration rate limit exceeded',
});

// refresh and logout authenticate from a cookie, so there is no user to key on.
// one refresh per access-token lifetime leaves room for several tabs on one IP
export const refreshRateLimiter = redisRateLimiter({
  prefix: 'rl:refresh:',
  windowMs: 15 * 60 * 1000,
  limit: 120,
  key: RateLimitKey.IP,
  eventType: SecurityEventType.REFRESH_RATE_LIMIT_EXCEEDED,
  message: 'Refresh rate limit exceeded',
});

// shared by every authenticated router. mounts after authMiddleware, which is
// what puts req.user in place for keyGenerator to read
export const apiRateLimiter = redisRateLimiter({
  prefix: 'rl:api:',
  windowMs: 15 * 60 * 1000,
  limit: 600,
  key: RateLimitKey.USER,
  eventType: SecurityEventType.API_RATE_LIMIT_EXCEEDED,
  message: 'API rate limit exceeded',
});
