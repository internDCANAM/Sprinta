import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';

const Source = { BODY: 'body', QUERY: 'query', PARAMS: 'params' } as const;

type Source = (typeof Source)[keyof typeof Source];

/**
 * Nothing catches here: Express routes a synchronous throw from a middleware
 * to `errorHandler`, which is where a failed parse becomes a 400.
 */
export function validate<T>(schema: ZodType<T>, source: Source = Source.BODY) {
  return (req: Request, _res: Response, next: NextFunction): void => {
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
  };
}
