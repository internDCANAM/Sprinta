import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";
import { badRequest } from "../utils/errors.js";

type Source = "body" | "query" | "params";

export function validate<T>(schema: ZodSchema<T>, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      // Ersätt inkommande payload med parsad version.
      (req as unknown as Record<Source, unknown>)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          badRequest("Valideringsfel", err.flatten().fieldErrors),
        );
      }
      next(err);
    }
  };
}
