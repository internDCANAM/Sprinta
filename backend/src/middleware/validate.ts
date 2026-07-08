import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { badRequest } from '../utils/http.js';

const Source = {
  BODY: 'body',
  QUERY: 'query',
  PARAMS: 'params',
} as const;

type Source = (typeof Source)[keyof typeof Source];

export function validate<T>(schema: ZodSchema<T>, source: Source = Source.BODY) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Replace the incoming payload with the parsed (coerced/validated) version.
      const parsed: unknown = schema.parse(req[source]);
      switch (source) {
        case Source.BODY:
          req.body = parsed;
          break;
        case Source.QUERY:
          req.query = parsed as typeof req.query;
          break;
        case Source.PARAMS:
          req.params = parsed as typeof req.params;
          break;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(badRequest(req, req.t.input.validationFailed, err.flatten().fieldErrors));
      }
      next(err);
    }
  };
}
