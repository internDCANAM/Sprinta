import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './utils/http.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { dealsRouter } from './routes/deals.js';
import { paymentsRouter } from './routes/payments.js';
import { adminRouter } from './routes/admin.js';
import { configRouter } from './routes/config.js';
import { NodeEnv } from './config/enums.js';
import { i18n } from './middleware/i18n.middleware.js';
import { createTranslator } from './lib/i18n.js';
import { AccessTokenPayload } from './utils/auth.js';
import { Deal } from '../prisma/generated/prisma/client.js';

// Express config file
// Industry standard: types/express/index.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      deal?: Deal;
      t: ReturnType<typeof createTranslator>;
    }
  }
}

export function createApp(): Express {
  const app = express();
  const CORS_CONST = { origin: env.CORS_ORIGIN, credentials: true };

  app.set('trust proxy', 1); // behind reverse proxy in production
  app.use(helmet());
  app.use(cors(CORS_CONST));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  // Must run after cookieParser (reads req.cookies) and before any router, so
  // req.t exists for every request. authMiddleware re-derives it once req.user
  // is available, since this runs before auth for the whole app.
  app.use(i18n);
  if (env.NODE_ENV !== NodeEnv.TEST) {
    app.use(
      morgan(env.NODE_ENV === NodeEnv.PRODUCTION ? 'combined' : 'dev', {
        stream: { write: (msg) => logger.info(msg.trim()) },
      })
    );
  }
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/me', meRouter);
  app.use('/api/v1/deals', dealsRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/config', configRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
