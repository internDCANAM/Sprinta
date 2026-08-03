import { z } from 'zod';
import type { Prisma } from '../../prisma/generated/prisma/client.js';
import { PaymentStatus } from './enums.js';
import { isoDate, minorUnits } from './primitives.js';

export const paymentInclude = {
  deal: { select: { id: true, externalId: true, title: true } },
} satisfies Prisma.PaymentInclude;

export const paymentSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  amountMinor: minorUnits,
  paymentDate: isoDate,
  status: z.nativeEnum(PaymentStatus),
  reference: z.string().nullable(),
  bankAccountMasked: z.string(),
  externalPaymentId: z.string().nullable(),
  createdAt: isoDate,
  deal: z.object({ id: z.string(), externalId: z.string(), title: z.string() }),
});
export type Payment = z.infer<typeof paymentSchema>;
