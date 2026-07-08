import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { DealType, DealStatus, PaymentStatus, UserRole } from '../../prisma/generated/prisma/enums.js';
import type { DomainConfig } from '../dto/api-types.js';

export const configRouter = Router();

configRouter.use(authMiddleware);

configRouter.get('/', (_req, res) => {
  const body: DomainConfig = {
    dealTypes: Object.values(DealType),
    dealStatuses: Object.values(DealStatus),
    paymentStatuses: Object.values(PaymentStatus),
    userRoles: Object.values(UserRole),
  };
  res.json(body);
});
