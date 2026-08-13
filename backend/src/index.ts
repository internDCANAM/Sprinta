import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

const app = createApp();

// express 5 hands bind failures to this callback instead of throwing them
const server = app.listen(env.PORT, (error?: Error) => {
  if (error) {
    logger.error(`Cannot bind port ${env.PORT}`, { message: error.message });
    process.exit(1);
  }
  logger.info(`Backend listening on port ${env.PORT}`, { env: env.NODE_ENV });
});

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down...`);
  server.close(() => {
    void Promise.allSettled([prisma.$disconnect(), redis.quit()]).then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
 