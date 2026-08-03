import { z } from 'zod';
import { Prisma } from '../../prisma/generated/prisma/client.js';

export const minorUnits = z.bigint().transform(Number);
export const decimalToNumber = z.instanceof(Prisma.Decimal).transform(Number);
export const isoDate = z.date().transform((d) => d.toISOString());
export const isoDateOrNull = z.date().nullable().transform((d) => d?.toISOString() ?? null);
