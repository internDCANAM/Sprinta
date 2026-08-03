import { afterAll, beforeAll, expect, test } from 'vitest';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import type { LoginResponse } from '../src/dto/user.js';
import type { User } from '../prisma/generated/prisma/client.js';

const BCRYPT_COST = 12;

// inserts an admin straight into the db
// admins have no self-registration endpoint
async function createAdmin(): Promise<{ user: User; password: string; }> {
  const email = faker.internet.email().toLowerCase();
  const password = faker.internet.password({ length: 16 });
  const name = faker.person.fullName();
  const user = await prisma.user.create({
    data: { email, name, isAdmin: true, passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
  });

  return { user, password };
}

// same as createAdmin, minus isAdmin
async function createUser(): Promise<{ user: User; password: string; }> {
  const email = faker.internet.email().toLowerCase();
  const password = faker.internet.password({ length: 16 });
  const name = faker.person.fullName();
  const user = await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
  });

  return { user, password };
}

// logs in via the real endpoint and returns the access token
async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const { accessToken } = (await response.json()) as LoginResponse;
  return accessToken;
}

let server: Server;
let baseUrl: string;

// starts a local server so tests hit real endpoints
// clears leftover login-limit counters so this run isn't already capped
beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const counters = await redis.keys('rl:login:*');
  if (counters.length) await redis.del(...counters);
});

// closes the server after tests run
// still runs if beforeAll failed — close()'s error callback is ignored, so this never throws
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  redis.disconnect();
});

// factory sanity check — the row it creates must actually be able to log in
test('createAdmin works', async () => {
  const { user, password } = await createAdmin();
  const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(stored.isAdmin).toBe(true);
  expect(stored.isActive).toBe(true);
  expect(stored.passwordHash).not.toBe(password);
  await expect(bcrypt.compare(password, stored.passwordHash)).resolves.toBe(true);

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password }),
  });
  expect(response.status).toBe(200);

  const login = (await response.json()) as LoginResponse;
  expect(login.accessToken).toBeTruthy();
  expect(login.user.email).toBe(user.email);

  console.log(`
    [ADMIN CREATED]
    login: ${user.email}
    passw: ${password}
  `);
});

// no token at all must be rejected before anything else runs
test('GET /admin/users no token', async () => {
  const response = await fetch(`${baseUrl}/admin/users`);
  expect(response.status).toBe(401);
});

// adminMiddleware gate — a valid token from a non-admin still isn't enough
test('GET /admin/users non-admin', async () => {
  const { user, password } = await createUser();
  const token = await login(user.email, password);

  const response = await fetch(`${baseUrl}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status).toBe(403);
});

// a real admin gets the full user list, including non-admins
test('GET /admin/users lists all', async () => {
  const { user: admin, password: adminPassword } = await createAdmin();
  const adminToken = await login(admin.email, adminPassword);
  const { user: owner } = await createUser();

  const response = await fetch(`${baseUrl}/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(response.status).toBe(200);

  const body = (await response.json()) as { data: Array<{ id: string; isAdmin: boolean; }>; };
  expect(body.data.some((row) => row.id === owner.id && row.isAdmin === false)).toBe(true);
});

// same gate as the GET routes, checked on the write path too
test('POST /admin/deals non-admin', async () => {
  const { user, password } = await createUser();
  const token = await login(user.email, password);

  const response = await fetch(`${baseUrl}/admin/deals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      ownerId: user.id,
      externalId: `TEST-${faker.string.uuid()}`,
      title: 'Should be rejected',
      dealType: 'MISC',
    }),
  });
  expect(response.status).toBe(403);
});

// assignedToId isn't in the response body — check it straight from the db
test('POST /admin/deals assigns creator', async () => {
  const { user: admin, password: adminPassword } = await createAdmin();
  const adminToken = await login(admin.email, adminPassword);
  const { user: owner } = await createUser();

  const externalId = `TEST-${faker.string.uuid()}`;
  const response = await fetch(`${baseUrl}/admin/deals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      ownerId: owner.id,
      externalId,
      title: 'Gallring 2026',
      dealType: 'THINNING',
    }),
  });
  expect(response.status).toBe(201);

  const created = (await response.json()) as {
    id: string;
    externalId: string;
    status: string;
    owner: { id: string; name: string; email: string; };
  };
  expect(created.externalId).toBe(externalId);
  expect(created.status).toBe('PLANNED');
  expect(created.owner.id).toBe(owner.id);

  const stored = await prisma.deal.findUniqueOrThrow({ where: { id: created.id } });
  expect(stored.assignedToId).toBe(admin.id);
});

// deal inserted straight via prisma still shows up through the real endpoint
test('GET /admin/deals lists all', async () => {
  const { user: admin, password: adminPassword } = await createAdmin();
  const adminToken = await login(admin.email, adminPassword);
  const { user: owner } = await createUser();

  const externalId = `TEST-${faker.string.uuid()}`;
  await prisma.deal.create({
    data: {
      ownerId: owner.id,
      externalId,
      title: 'Slutavverkning 2026',
      dealType: 'REGENERATION_FELLING',
      status: 'PLANNED',
    },
  });

  const response = await fetch(`${baseUrl}/admin/deals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(response.status).toBe(200);

  const body = (await response.json()) as { data: Array<{ externalId: string; }>; };
  expect(body.data.some((deal) => deal.externalId === externalId)).toBe(true);
});

// limit is 10/min — a fresh IP so this can't inherit a stale count from a
// previous run against the same (shared, non-reset) redis instance
test('rate limits logins', async () => {
  const address = faker.internet.ipv4();
  const attempt = () =>
    fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': address },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong' }),
    });

  const responses = await Promise.all(Array.from({ length: 11 }, attempt));
  const limited = responses.filter((r) => r.status === 429);
  expect(limited.length).toBeGreaterThan(0);
});
