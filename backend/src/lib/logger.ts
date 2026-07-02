import winston from 'winston';
import { env } from '../config/env.js';
import { NodeEnv } from '../config/enums.js';

/**
 * Application-wide logger instance.
 *
 * - **Production** — outputs structured JSON (one object per line) so log
 *   aggregators (Datadog, CloudWatch, etc.) can parse fields directly.
 * - **Development** — outputs colourised human-readable lines with a short
 *   timestamp (`HH:mm:ss level message {meta}`).
 *
 * The active log level is set by `LOG_LEVEL` in `.env` — only messages at
 * that severity or higher are emitted. Use the named methods rather than
 * `console.*` so that levels, timestamps, and formatting are applied consistently.
 *
 * @example
 * logger.info('User logged in', { userId, role });
 * logger.error('Unexpected failure', { message: err.message });
 */
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format:
    env.NODE_ENV === NodeEnv.PRODUCTION
      ? // structured JSON — includes timestamp field for log aggregators
        winston.format.combine(winston.format.timestamp(), winston.format.json())
      : // colourised one-liner for local terminals
        winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) =>
            `${String(timestamp)} ${String(level)} ${String(message)}${
              Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
            }`
          )
        ),
  transports: [new winston.transports.Console()],
});
