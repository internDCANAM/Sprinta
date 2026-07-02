import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { dealsRouter } from './routes/deals.js';
import { paymentsRouter } from './routes/payments.js';
import { adminRouter } from './routes/admin.js';
import { NodeEnv } from './config/enums.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1); // behind reverse proxy in production
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
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
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
