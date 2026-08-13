import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, expect, test } from 'vitest';
import bcrypt from 'bcrypt';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import type { LoginResponse } from '../src/dto/user.js';
import type { DealDetail } from '../src/dto/deal.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import type { Deal, User } from '../prisma/generated/prisma/client.js';

const BCRYPT_COST = 12;

// inserts a non-admin straight into the db
async function createUser(): Promise<{ user: User; password: string; }> {
  const email = faker.internet.email().toLowerCase();
  const password = faker.internet.password({ length: 16 });
  const name = faker.person.fullName();
  const user = await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
  });
  return { user, password };
}

// deal owned by the given user — seeded via prisma so the test owns the setup
async function createDeal(ownerId: string): Promise<Deal> {
  return prisma.deal.create({
    data: {
      ownerId,
      externalId: `TEST-${faker.string.uuid()}`,
      title: 'Gallring 2026',
      dealType: 'THINNING',
      status: 'PLANNED',
    },
  });
}

// logs in via the real endpoint and returns the access token
async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as LoginResponse;
  if (!response.ok) throw new Error(`login failed: ${response.status} ${JSON.stringify(body)}`);
  return body.accessToken;
}

let server: Server;
let baseUrl: string;

// starts a local server so tests hit real endpoints
// clears leftover login-limit counters so this run isn't already capped
beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const counters = await redis.keys('rl:*');
  if (counters.length) await redis.del(...counters);
});

// closes the server after tests run
// still runs if beforeAll failed — close()'s error callback is ignored, so this never throws
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  redis.disconnect();
});

// owner can read their own deal through dealOwnershipMiddleware
test('GET /deals/:id owner', async () => {
  const { user, password } = await createUser();
  const deal = await createDeal(user.id);
  const token = await login(user.email, password);

  const response = await fetch(`${baseUrl}/deals/${deal.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as DealDetail;

  console.log(`
    [GET /deals/:id owner]
    status: ${response.status}
    deal:   ${deal.id}
    owner:  ${user.email}
    body:   ${JSON.stringify(body)}
  `);

  expect(response.status).toBe(200);
  expect(body.id).toBe(deal.id);
  expect(body.externalId).toBe(deal.externalId);
});

// a second user must not read another owner's deal
test('GET /deals/:id other user', async () => {
  const [{ user: owner }, { user: other, password: otherPassword }] = await Promise.all([
    createUser(),
    createUser(),
  ]);
  const deal = await createDeal(owner.id);
  const token = await login(other.email, otherPassword);

  const response = await fetch(`${baseUrl}/deals/${deal.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.text();

  console.log(`
    [GET /deals/:id other user]
    status: ${response.status}
    deal:   ${deal.id}
    owner:  ${owner.email}
    other:  ${other.email}
    body:   ${body}
  `);

  expect(response.status).toBe(403);
});

// unknown deal id is not found (after auth)
test('GET /deals/:id missing', async () => {
  const { user, password } = await createUser();
  const token = await login(user.email, password);
  const missingId = faker.string.uuid();

  const response = await fetch(`${baseUrl}/deals/${missingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.text();

  console.log(`
    [GET /deals/:id missing]
    status: ${response.status}
    id:     ${missingId}
    body:   ${body}
  `);

  expect(response.status).toBe(404);
});

// a malformed id is the caller's mistake, not a missing row
test('GET /deals/:id not a uuid', async () => {
  const { user, password } = await createUser();
  const token = await login(user.email, password);

  const response = await fetch(`${baseUrl}/deals/not-a-uuid/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as { code: string; };

  console.log(`
    [GET /deals/:id not a uuid]
    status: ${response.status}
    body:   ${JSON.stringify(body)}
  `);

  expect(response.status).toBe(400);
  expect(body.code).toBe('VALIDATION_ERROR');
});

// no token at all must be rejected before ownership runs
test('GET /deals/:id no token', async () => {
  const { user } = await createUser();
  const deal = await createDeal(user.id);

  const response = await fetch(`${baseUrl}/deals/${deal.id}`);
  const body = await response.text();

  console.log(`
    [GET /deals/:id no token]
    status: ${response.status}
    deal:   ${deal.id}
    body:   ${body}
  `);

  expect(response.status).toBe(401);
});
