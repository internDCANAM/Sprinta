import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { NodeEnv } from '../config/enums.js';

/**
 * Shared {@link PrismaClient} instance — the single connection pool to the database.
 *
 * Import this everywhere instead of calling `new PrismaClient()`. Creating multiple
 * instances opens multiple connection pools and exhausts the database quickly.
 *
 * In development, `'query'` logging is enabled so every SQL statement appears in
 * the terminal. In production only warnings and errors are logged.
 */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === NodeEnv.DEV ? ['query', 'warn', 'error'] : ['warn', 'error'],
});
