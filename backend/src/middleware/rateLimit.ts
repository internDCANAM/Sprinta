import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../lib/redis.js";
import { recordSecurityEvent } from "../utils/securityEvents.js";

export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "För många inloggningsförsök, försök igen om en minut",
    code: "RATE_LIMITED",
    statusCode: 429,
  },

  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<never>,
    prefix: "rl:login:",
  }),

  handler: (req, res) => {
    void recordSecurityEvent({
      req,
      eventType: "LOGIN_RATE_LIMIT_EXCEEDED",
      severity: "HIGH",
      message: "Login rate limit exceeded",
      metadata: {
        control: "ISO27001_A.8.15_A.8.16",
      },
    });

    res.status(429).json({
      error: "För många inloggningsförsök, försök igen senare",
      code: "RATE_LIMITED",
      statusCode: 429,
    });
  },
});
