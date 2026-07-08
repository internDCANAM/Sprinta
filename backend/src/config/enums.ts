// Infrastructure enums for backend configuration.
// Domain enums (deal statuses, roles, etc.) are sourced directly from
// backend/prisma/generated/prisma/enums.ts (Prisma-generated). This file only
// holds infrastructure/config enums that have no Prisma schema equivalent.
// Future additions: EmailDriver (SMTP, SES, SENDGRID)
//                   QueueDriver (BULL, SQS, INNGEST)

/**
 * Identifies the runtime environment. Controls logging format, morgan output,
 * Prisma query logging, and cookie security flags.
 *
 * Values are lowercase to match Node.js convention — `process.env.NODE_ENV`
 * is always a lowercase string. Libraries like Express read it directly.
 */
export const NodeEnv = {
  DEV: 'development',
  TEST: 'test',
  PRODUCTION: 'production',
} as const;

export type NodeEnv = (typeof NodeEnv)[keyof typeof NodeEnv];

/**
 * Selects the file storage backend. Read from `STORAGE_DRIVER` in `.env`.
 * The storage module uses this to instantiate the correct driver at startup.
 */
export const StorageDriver = {
  LOCAL: 'local',    // files written to the path in STORAGE_LOCAL_DIR
  R2: 'r2',          // Cloudflare R2 object storage
} as const;

export type StorageDriver = (typeof StorageDriver)[keyof typeof StorageDriver];

/**
 * Valid values for the `LOG_LEVEL` env var. Maps directly to Winston's npm
 * severity scale — setting a level logs that level and everything above it.
 *
 * Severity (highest → lowest): ERROR › WARN › INFO › HTTP › VERBOSE › DEBUG › SILLY
 *
 * Typical usage: `INFO` in production, `DEBUG` in development.
 */
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];
