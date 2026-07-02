import 'dotenv/config';
import { z } from 'zod';
import { LogLevel, NodeEnv, StorageDriver } from './enums.js';

// Zod schema declaring every required env var and its expected shape.
// z.nativeEnum validates the raw string against the enum's values.
// z.coerce.number() converts the string from process.env to a number before validating.
const EnvSchema = z.object({
  NODE_ENV:           z.nativeEnum(NodeEnv),
  PORT:               z.coerce.number().int().positive(),
  LOG_LEVEL:          z.nativeEnum(LogLevel),
  DATABASE_URL:       z.string().url(),
  REDIS_URL:          z.string().url(),
  REDIS_MAX_RETRIES:  z.coerce.number().int().nonnegative(),
  JWT_ACCESS_SECRET:  z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL:     z.string(),
  JWT_REFRESH_TTL:    z.string(),
  ENCRYPTION_KEY:     z.string().regex(/^[0-9a-f]{64}$/i),
  STORAGE_DRIVER:     z.nativeEnum(StorageDriver),
  STORAGE_LOCAL_DIR:  z.string(),
  CORS_ORIGIN:        z.string().url(),
});

// process.exit(1) here means the HTTP server
// never starts if any value is missing or invalid.
function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    process.stderr.write(`Invalid .env — aborting: ${JSON.stringify(parsed.error.flatten().fieldErrors)}\n`);
    process.exit(1);
  }
  return parsed.data;
}

/**
 * Validated, typed snapshot of all required environment variables.
 *
 * Loaded once at module initialisation — if any value is missing or fails
 * validation the process exits before the HTTP server starts (fail-fast).
 *
 * Import `env` instead of reading `process.env` directly anywhere else.
 */
export const env = loadEnv();
