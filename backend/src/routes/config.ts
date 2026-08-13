import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { domainConfig } from '../dto/config.js';

export const configRouter = Router();

configRouter.use(authMiddleware);

configRouter.get('/', (_req, res) => { res.json(domainConfig()); });
