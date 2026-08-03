import { z } from 'zod';
import type { Prisma } from '../../prisma/generated/prisma/client.js';
import { DealEventType, DealStatus, DealType, DocumentType } from './enums.js';
import { decimalToNumber, isoDate, isoDateOrNull, minorUnits } from './primitives.js';

export const dealSummaryInclude = {
  property: { select: { id: true, name: true } },
  _count: { select: { events: true, timberPosts: true } },
} satisfies Prisma.DealInclude;

export const dealSummarySchema = z.object({
  id: z.string(),
  externalId: z.string(),
  title: z.string(),
  dealType: z.nativeEnum(DealType),
  status: z.nativeEnum(DealStatus),
  estimatedGrossMinor: minorUnits.nullable(),
  finalGrossMinor: minorUnits.nullable(),
  createdAt: isoDate,
  property: z.object({ id: z.string(), name: z.string() }).nullable(),
  _count: z.object({ events: z.number(), timberPosts: z.number() }),
});

export const dealDetailInclude = {
  property: true,
  _count: {
    select: { events: true, timberPosts: true, costs: true, documents: true, messages: true },
  },
} satisfies Prisma.DealInclude;

export const dealDetailSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  title: z.string(),
  dealType: z.nativeEnum(DealType),
  status: z.nativeEnum(DealStatus),
  estimatedGrossMinor: minorUnits.nullable(),
  finalGrossMinor: minorUnits.nullable(),
  propertyId: z.string().nullable(),
  assignedToId: z.string().nullable(),
  syncedAt: isoDateOrNull,
  createdAt: isoDate,
  updatedAt: isoDate,
  property: z
    .object({
      id: z.string(),
      name: z.string(),
      cadastralId: z.string(),
      municipality: z.string(),
      areaHa: decimalToNumber,
    })
    .nullable(),
  _count: z.object({
    events: z.number(),
    timberPosts: z.number(),
    costs: z.number(),
    documents: z.number(),
    messages: z.number(),
  }),
});

export const dealEventSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  eventType: z.nativeEnum(DealEventType),
  label: z.string(),
  plannedDate: isoDateOrNull,
  actualDate: isoDateOrNull,
  note: z.string().nullable(),
  createdAt: isoDate,
});

export const timberPostSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  assortment: z.string(),
  volumeM3: decimalToNumber,
  pricePerM3Minor: minorUnits,
  grossMinor: minorUnits,
  measurementSource: z.string().nullable(),
  createdAt: isoDate,
});

export const dealCostSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  costType: z.string(),
  amountMinor: minorUnits,
  note: z.string().nullable(),
  createdAt: isoDate,
});

export const documentSummarySchema = z.object({
  id: z.string(),
  docType: z.nativeEnum(DocumentType),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  createdAt: isoDate,
});

export const messageInclude = {
  sender: { select: { id: true, name: true } },
} satisfies Prisma.MessageInclude;

export const messageSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  senderId: z.string(),
  body: z.string(),
  readAt: isoDateOrNull,
  createdAt: isoDate,
  sender: z.object({ id: z.string(), name: z.string() }),
});

export const messageInputSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type DealSummary = z.infer<typeof dealSummarySchema>;
export type DealDetail = z.infer<typeof dealDetailSchema>;
export type DealEvent = z.infer<typeof dealEventSchema>;
export type TimberPost = z.infer<typeof timberPostSchema>;
export type DealCost = z.infer<typeof dealCostSchema>;
export type DocumentSummary = z.infer<typeof documentSummarySchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessageInput = z.infer<typeof messageInputSchema>;

export interface CreateDealInput {
  customerId: string;
  propertyId?: string;
  externalId: string;
  title: string;
  dealType: DealType;
  status?: DealStatus;
  estimatedGrossMinor?: number;
  assignedAdminId?: string;
}
