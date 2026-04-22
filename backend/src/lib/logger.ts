import winston from "winston";
import { env } from "../config/env.js";

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format:
    env.NODE_ENV === "production"
      ? winston.format.combine(winston.format.timestamp(), winston.format.json())
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: "HH:mm:ss" }),
          winston.format.printf(
            ({ timestamp, level, message, ...meta }) =>
              `${timestamp} ${level} ${message}${
                Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ""
              }`,
          ),
        ),
  transports: [new winston.transports.Console()],
});
