import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on("error", (err: Error) => {
  logger.error("Redis-fel", { message: err.message });
});

redis.on("connect", () => {
  logger.info("Redis ansluten");
});
