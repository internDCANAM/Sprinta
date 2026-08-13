import { afterAll, beforeAll, expect, test } from 'vitest';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { CSRF_COOKIE_NAME } from '../src/middleware/csrf.middleware.js';
import { REFRESH_COOKIE_NAME } from '../src/utils/auth.js';
import type { LoginResponse, AdminUserRow } from '../src/dto/user.js';
import type { AdminDealRow } from '../src/dto/deal.js';
import type { Paginated } from '../src/dto/pagination.js';
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

type Credentials = { accessToken: string; cookies: string; csrfToken: string; };

// logs in via the real endpoint and returns everything a request needs — the
// bearer token plus the CSRF cookie/header pair every mutating route expects
async function login(email: string, password: string): Promise<Credentials> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as LoginResponse;
  if (!response.ok) throw new Error(`login failed: ${response.status} ${JSON.stringify(body)}`);
  const setCookies = response.headers.getSetCookie();
  const nameValue = (prefix: string) =>
    setCookies.find((c) => c.startsWith(`${prefix}=`))!.split(';')[0]!;
  const csrf = nameValue(CSRF_COOKIE_NAME);
  return {
    accessToken: body.accessToken,
    cookies: `${nameValue(REFRESH_COOKIE_NAME)}; ${csrf}`,
    csrfToken: decodeURIComponent(csrf.slice(csrf.indexOf('=') + 1)),
  };
}

// full header set for a mutating request — CSRF is enforced app-wide, so a
// bearer token alone is not enough on anything but a read
function authHeaders(creds: Credentials): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${creds.accessToken}`,
    Cookie: creds.cookies,
    'x-csrf-token': creds.csrfToken,
  };
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
  const login = (await response.json()) as LoginResponse;

  console.log(`
    [ADMIN CREATED]
    login: ${user.email}
    passw: ${password}
  `);

  expect(response.status).toBe(200);
  expect(login.accessToken).toBeTruthy();
  expect(login.user.email).toBe(user.email);
});

// no token at all must be rejected before anything else runs
test('GET /admin/users no token', async () => {
  const response = await fetch(`${baseUrl}/admin/users`);
  const body = await response.text();

  console.log(`
    [GET /admin/users no token]
    status: ${response.status}
    body:   ${body}
  `);

  expect(response.status).toBe(401);
});

// adminMiddleware gate — a valid token from a non-admin still isn't enough
test('GET /admin/users non-admin', async () => {
  const { user, password } = await createUser();
  const { accessToken } = await login(user.email, password);

  const response = await fetch(`${baseUrl}/admin/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.text();

  console.log(`
    [GET /admin/users non-admin]
    status: ${response.status}
    user:   ${user.email}
    body:   ${body}
  `);

  expect(response.status).toBe(403);
});

// a real admin gets the full user list, including non-admins
test('GET /admin/users lists all', async () => {
  const [{ user: admin, password: adminPassword }, { user: owner }] = await Promise.all([
    createAdmin(),
    createUser(),
  ]);
  const { accessToken } = await login(admin.email, adminPassword);

  const response = await fetch(`${baseUrl}/admin/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as Paginated<AdminUserRow>;

  console.log(`
    [GET /admin/users lists all]
    status: ${response.status}
    owner:  ${owner.email}
    count:  ${body.data.length}
  `);

  expect(response.status).toBe(200);
  expect(body.data.some((row) => row.id === owner.id && row.isAdmin === false)).toBe(true);
});

// same gate as the GET routes, checked on the write path too
test('POST /admin/deals non-admin', async () => {
  const { user, password } = await createUser();
  const creds = await login(user.email, password);

  const response = await fetch(`${baseUrl}/admin/deals`, {
    method: 'POST',
    headers: authHeaders(creds),
    body: JSON.stringify({
      ownerId: user.id,
      externalId: `TEST-${faker.string.uuid()}`,
      title: 'Should be rejected',
      dealType: 'MISC',
    }),
  });
  const body = await response.text();

  console.log(`
    [POST /admin/deals non-admin]
    status: ${response.status}
    body:   ${body}
  `);

  expect(response.status).toBe(403);
});

// assignedToId isn't in the response body — check it straight from the db
test('POST /admin/deals assigns creator', async () => {
  const [{ user: admin, password: adminPassword }, { user: owner }] = await Promise.all([
    createAdmin(),
    createUser(),
  ]);
  const creds = await login(admin.email, adminPassword);

  const externalId = `TEST-${faker.string.uuid()}`;
  const response = await fetch(`${baseUrl}/admin/deals`, {
    method: 'POST',
    headers: authHeaders(creds),
    body: JSON.stringify({
      ownerId: owner.id,
      externalId,
      title: 'Gallring 2026',
      dealType: 'THINNING',
    }),
  });
  const created = (await response.json()) as AdminDealRow;

  console.log(`
    [POST /admin/deals assigns creator]
    status: ${response.status}
    admin:  ${admin.email}
    owner:  ${owner.email}
    body:   ${JSON.stringify(created)}
  `);

  expect(response.status).toBe(201);
  expect(created.externalId).toBe(externalId);
  expect(created.status).toBe('PLANNED');
  expect(created.owner.id).toBe(owner.id);

  const stored = await prisma.deal.findUniqueOrThrow({ where: { id: created.id } });
  expect(stored.assignedToId).toBe(admin.id);
});

// deal without csrf token is not created
test('POST /admin/deals without csrf token', async () => {
  const [{ user: admin, password: adminPassword }, { user: owner }] = await Promise.all([
    createAdmin(),
    createUser(),
  ]);
  const creds = await login(admin.email, adminPassword);

  const externalId = `TEST-${faker.string.uuid()}`;
  const forged = await fetch(`${baseUrl}/admin/deals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.accessToken}` },
    body: JSON.stringify({ ownerId: owner.id, externalId, title: 'Forged', dealType: 'MISC' }),
  });
  const forgedBody = await forged.text();

  console.log(`
    [POST /admin/deals without csrf token]
    status: ${forged.status}
    body:   ${forgedBody}
  `);

  expect(forged.status).toBe(403);
  expect(await prisma.deal.count({ where: { externalId } })).toBe(0);
});

// deal inserted straight via prisma still shows up through the real endpoint
test('GET /admin/deals lists all', async () => {
  const [{ user: admin, password: adminPassword }, { user: owner }] = await Promise.all([
    createAdmin(),
    createUser(),
  ]);
  const { accessToken } = await login(admin.email, adminPassword);

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
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as Paginated<AdminDealRow>;

  console.log(`
    [GET /admin/deals lists all]
    status: ${response.status}
    admin:  ${admin.email}
    count:  ${body.data.length}
  `);

  expect(response.status).toBe(200);
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

  console.log(`
    [rate limits logins]
    attempts: ${responses.length}
    limited:  ${limited.length}
  `);

  expect(limited.length).toBeGreaterThan(0);
});
