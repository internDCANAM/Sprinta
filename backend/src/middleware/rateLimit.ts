import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../lib/redis.js';
import { SecurityEventSeverity } from '../../prisma/generated/prisma/enums.js';
import { ErrorCode } from '../dto/error.js';
import { recordSecurityEvent } from '../utils/securityEvents.js';

interface AuthRateLimit {
  prefix: string;     // Redis key namespace, one counter per endpoint
  windowMs: number;   // how far back the counter looks
  limit: number;      // requests allowed per window, per IP
  eventType: string;  // recorded on the security event when the limit trips
  message: string;    // audit-log text not shown to the client
}

/**
 * counters live in Redis so they survive a restart and hold across every
 * instance. an in-memory limiter would reset on deploy and count each
 * process separately, which is most of the protection gone.
 */
function authRateLimiter(config: AuthRateLimit): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,

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

export const loginRateLimiter = authRateLimiter({
  prefix: 'rl:login:',
  windowMs: 60 * 1000,
  limit: 10,
  eventType: 'LOGIN_RATE_LIMIT_EXCEEDED',
  message: 'Login rate limit exceeded',
});

/**
 * Far tighter than login: a real person registers once, so anything past a
 * handful an hour from one address is scripted. Each attempt also costs a
 * bcrypt hash, which makes an unthrottled endpoint a cheap way to burn CPU.
 */
export const registerRateLimiter = authRateLimiter({
  prefix: 'rl:register:',
  windowMs: 60 * 60 * 1000,
  limit: 5,
  eventType: 'REGISTER_RATE_LIMIT_EXCEEDED',
  message: 'Registration rate limit exceeded',
});
