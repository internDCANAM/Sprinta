import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { apiRateLimiter } from '../middleware/rateLimit.js';
import { dealOwnershipMiddleware, type DealRequest } from '../middleware/ownership.js';
import { Source, validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';
import { uuidParamsSchema } from '../dto/params.js';
import type { AuthenticatedRequest } from '../utils/auth.js';
import { paginate, paginationQuerySchema, type Collection, type Paginated } from '../dto/pagination.js';
import { dealCostSchema, dealDetailInclude, dealDetailSchema, dealEventSchema, dealSummaryInclude, dealSummarySchema, documentSummarySchema, messageInclude, messageInputSchema, messageSchema, timberPostSchema, type DealCost, type DealDetail, type DealEvent, type DealSummary, type DocumentSummary, type Message, type TimberPost } from '../dto/deal.js';

async function listDeals(req: AuthenticatedRequest): Promise<Paginated<DealSummary>> {
  const where = { ownerId: req.user.userId };
  return paginate(
    paginationQuerySchema.parse(req.query),
    dealSummarySchema,
    () => prisma.deal.count({ where }),
    (skip, take) =>
      prisma.deal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: dealSummaryInclude,
      })
  );
}

async function readDeal(req: DealRequest): Promise<DealDetail> {
  const deal = await prisma.deal.findUnique({
    where: { id: req.deal.id },
    include: dealDetailInclude,
  });
  return dealDetailSchema.parse(deal);
}

async function listEvents(req: DealRequest): Promise<Collection<DealEvent>> {
  const events = await prisma.dealEvent.findMany({
    where: { dealId: req.deal.id },
    orderBy: [
      { actualDate: { sort: 'asc', nulls: 'last' } },
      { plannedDate: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' },
    ],
  });
  return { data: events.map((event) => dealEventSchema.parse(event)) };
}

async function listTimberPosts(req: DealRequest): Promise<Collection<TimberPost>> {
  const posts = await prisma.timberPost.findMany({
    where: { dealId: req.deal.id },
    orderBy: { createdAt: 'asc' },
  });
  return { data: posts.map((post) => timberPostSchema.parse(post)) };
}

async function listCosts(req: DealRequest): Promise<Collection<DealCost>> {
  const costs = await prisma.dealCost.findMany({
    where: { dealId: req.deal.id },
    orderBy: { createdAt: 'asc' },
  });
  return { data: costs.map((cost) => dealCostSchema.parse(cost)) };
}

async function listDocuments(req: DealRequest): Promise<Collection<DocumentSummary>> {
  const docs = await prisma.document.findMany({
    where: { dealId: req.deal.id },
    orderBy: { createdAt: 'desc' },
  });
  return { data: docs.map((doc) => documentSummarySchema.parse(doc)) };
}

async function listMessages(req: DealRequest): Promise<Collection<Message>> {
  const messages = await prisma.message.findMany({
    where: { dealId: req.deal.id },
    orderBy: { createdAt: 'asc' },
    include: messageInclude,
  });
  return { data: messages.map((message) => messageSchema.parse(message)) };
}

async function postMessage(req: DealRequest): Promise<Message> {
  const { body } = messageInputSchema.parse(req.body);
  const message = await prisma.message.create({
    data: { dealId: req.deal.id, senderId: req.user.userId, body },
    include: messageInclude,
  });
  return messageSchema.parse(message);
}

export const dealsRouter = Router();
dealsRouter.use(authMiddleware, apiRateLimiter);
dealsRouter.get('/', asyncHandler<AuthenticatedRequest>(async (req, res) => res.json(await listDeals(req))));
// runs for every /:id path below, so a malformed id never reaches prisma
dealsRouter.use('/:id', validate(uuidParamsSchema, Source.PARAMS));
dealsRouter.get('/:id', dealOwnershipMiddleware, asyncHandler<DealRequest>(async (req, res) => res.json(await readDeal(req))));
dealsRouter.get('/:id/events', dealOwnershipMiddleware, asyncHandler<DealRequest>(async (req, res) => res.json(await listEvents(req))));
dealsRouter.get('/:id/timber', dealOwnershipMiddleware, asyncHandler<DealRequest>(async (req, res) => res.json(await listTimberPosts(req))));
dealsRouter.get('/:id/costs', dealOwnershipMiddleware, asyncHandler<DealRequest>(async (req, res) => res.json(await listCosts(req))));
dealsRouter.get('/:id/documents', dealOwnershipMiddleware, asyncHandler<DealRequest>(async (req, res) => res.json(await listDocuments(req))));
dealsRouter.get('/:id/messages', dealOwnershipMiddleware, asyncHandler<DealRequest>(async (req, res) => res.json(await listMessages(req))));
dealsRouter.post('/:id/messages', dealOwnershipMiddleware, asyncHandler<DealRequest>(async (req, res) => res.status(201).json(await postMessage(req))));
