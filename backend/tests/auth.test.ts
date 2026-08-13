import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, expect, test } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import type { LoginResponse, RefreshResponse, UserProfile } from '../src/dto/user.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { CSRF_COOKIE_NAME } from '../src/middleware/csrf.middleware.js';
import type { User } from '../prisma/generated/prisma/client.js';

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

// name=value pair suitable for a request's Cookie header
function cookieNameValue(setCookieHeader: string): string { return setCookieHeader.split(';')[0]!; }

// decoded value only, suitable for the x-csrf-token header — csrf-csrf
// compares against the cookie-parser-decoded value, not the raw Set-Cookie text
function cookieValue(setCookieHeader: string): string {
  const nameValue = cookieNameValue(setCookieHeader);
  return decodeURIComponent(nameValue.slice(nameValue.indexOf('=') + 1));
}

// login on its own fake IP isolated from shared login rate-limit counter.
// returns the refresh + CSRF cookies login sets + decoded CSRF token to send
// back as the x-csrf-token header
async function loginWithCookie(email: string, password: string):
  Promise<{ accessToken: string; cookie: string; csrfCookie: string; csrfToken: string; }> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': faker.internet.ipv4() },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as LoginResponse;
  if (!response.ok) throw new Error(`login failed: ${response.status} ${JSON.stringify(body)}`);
  const setCookies = response.headers.getSetCookie();
  const refreshSetCookie = setCookies.find((c) => c.startsWith('refresh_token='))!;
  const csrfSetCookie = setCookies.find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))!;
  return {
    accessToken: body.accessToken,
    cookie: cookieNameValue(refreshSetCookie),
    csrfCookie: cookieNameValue(csrfSetCookie),
    csrfToken: cookieValue(csrfSetCookie),
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

// issued access token is accepted on a protected route
test('GET /me valid token', async () => {
  const { user, password } = await createUser();
  const token = await login(user.email, password);

  const response = await fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await response.json()) as UserProfile;

  console.log(`
    [GET /me valid token]
    status: ${response.status}
    user:   ${user.email}
    body:   ${JSON.stringify(body)}
  `);

  expect(response.status).toBe(200);
  expect(body.id).toBe(user.id);
  expect(body.email).toBe(user.email);
});

// flip one character in the JWT signature so jwt.verify fails
test('GET /me tampered token', async () => {
  const { user, password } = await createUser();
  const token = await login(user.email, password);
  const [header, payload, sig] = token.split('.');
  const flipped = (sig![0] === 'a' ? 'b' : 'a') + sig!.slice(1);
  const tampered = `${header}.${payload}.${flipped}`;

  const response = await fetch(`${baseUrl}/me`, {
    headers: { Authorization: `Bearer ${tampered}` },
  });
  const body = await response.text();

  console.log(`
    [GET /me tampered token]
    status: ${response.status}
    body:   ${body}
  `);

  expect(response.status).toBe(401);
});

// token signed with a different secret must not verify
test('GET /me wrong secret', async () => {
  const { user } = await createUser();
  const forged = jwt.sign(
    { userId: user.id, locale: 'sv', isAdmin: false },
    'wrong-secret-not-the-configured-one!!',
    { expiresIn: '1h' }
  );

  const response = await fetch(`${baseUrl}/me`, {
    headers: { Authorization: `Bearer ${forged}` },
  });
  const body = await response.text();

  console.log(`
    [GET /me wrong secret]
    status: ${response.status}
    user:   ${user.email}
    body:   ${body}
  `);

  expect(response.status).toBe(401);
});

// exp already in the past — verifyAccessToken throws TokenExpiredError
test('GET /me expired token', async () => {
  const { user } = await createUser();
  const expired = jwt.sign(
    { userId: user.id, locale: 'sv', isAdmin: false },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '-1s' }
  );

  const response = await fetch(`${baseUrl}/me`, {
    headers: { Authorization: `Bearer ${expired}` },
  });
  const body = await response.text();

  console.log(`
    [GET /me expired token]
    status: ${response.status}
    user:   ${user.email}
    body:   ${body}
  `);

  expect(response.status).toBe(401);
});

// no token at all must be rejected before anything else runs
test('GET /me no token', async () => {
  const response = await fetch(`${baseUrl}/me`);
  const body = await response.text();

  console.log(`
    [GET /me no token]
    status: ${response.status}
    body:   ${body}
  `);

  expect(response.status).toBe(401);
});

// right email, wrong password — own fake IP so this doesn't eat into the
// file's shared login rate-limit budget
test('POST /auth/login wrong password', async () => {
  const { user } = await createUser();
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': faker.internet.ipv4() },
    body: JSON.stringify({ email: user.email, password: 'not-the-real-password' }),
  });
  const body = await response.text();

  console.log(`
    [POST /auth/login wrong password]
    status: ${response.status}
    user:   ${user.email}
    body:   ${body}
  `);

  expect(response.status).toBe(401);
});

// isActive: false must fail login exactly like a bad password — no special-casing
test('POST /auth/login inactive user', async () => {
  const password = faker.internet.password({ length: 16 });
  const user = await prisma.user.create({
    data: {
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      isActive: false,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
    },
  });
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': faker.internet.ipv4() },
    body: JSON.stringify({ email: user.email, password }),
  });
  const body = await response.text();

  console.log(`
    [POST /auth/login inactive user]
    status: ${response.status}
    user:   ${user.email}
    body:   ${body}
  `);

  expect(response.status).toBe(401);
});

// unknown address, wrong password, deactivated account must be byte-for-byte
// indistinguishable — see doc comment on login() in routes/auth.ts: a distinct
// message for any of them would let the login form be used to test whether a
// given address has an account at all
test('POST /auth/login identical rejection for unknown/wrong/inactive', async () => {
  const inactivePassword = faker.internet.password({ length: 16 });
  const [{ user }, inactive] = await Promise.all([
    createUser(),
    prisma.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
        isActive: false,
        passwordHash: await bcrypt.hash(inactivePassword, BCRYPT_COST),
      },
    }),
  ]);
  const ip = faker.internet.ipv4();
  const attempt = (email: string, password: string) =>
    fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ email, password }),
    });

  const [unknown, wrongPassword, inactiveLogin] = await Promise.all([
    attempt(faker.internet.email().toLowerCase(), 'whatever-password'),
    attempt(user.email, 'not-the-real-password'),
    attempt(inactive.email, inactivePassword),
  ]);
  const [unknownBody, wrongBody, inactiveBody] = await Promise.all([
    unknown.text(),
    wrongPassword.text(),
    inactiveLogin.text(),
  ]);

  console.log(`
    [POST /auth/login identical rejection]
    unknown:  ${unknown.status} ${unknownBody}
    wrong:    ${wrongPassword.status} ${wrongBody}
    inactive: ${inactiveLogin.status} ${inactiveBody}
  `);

  expect(unknown.status).toBe(401);
  expect(wrongPassword.status).toBe(401);
  expect(inactiveLogin.status).toBe(401);
  expect(unknownBody).toBe(wrongBody);
  expect(wrongBody).toBe(inactiveBody);
});

// failed login worded per Accept-Language — proves req.t drives error bodies
test('POST /auth/login locale changes error message', async () => {
  const ip = faker.internet.ipv4();
  const attempt = (locale: string) =>
    fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip,
        'Accept-Language': locale,
      },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong' }),
    });

  const [sv, en] = await Promise.all([attempt('sv'), attempt('en')]);
  const [svBody, enBody] = await Promise.all([
    sv.json() as Promise<{ error: string; }>,
    en.json() as Promise<{ error: string; }>,
  ]);

  console.log(`
    [POST /auth/login locale]
    sv: ${sv.status} ${svBody.error}
    en: ${en.status} ${enBody.error}
  `);

  expect(sv.status).toBe(401);
  expect(en.status).toBe(401);
  expect(svBody.error).not.toBe(enBody.error);
  expect(svBody.error).toBe('Fel e-post eller lösenord.');
  expect(enBody.error).toBe('Invalid email or password.');
});

// no cookies at all — doubleCsrfProtection rejects before the handler,
// which owns the (now unreachable in this case) missing-refresh-cookie check
test('POST /auth/refresh no cookie', async () => {
  const response = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST' });
  const body = await response.text();

  console.log(`
    [POST /auth/refresh no cookie]
    status: ${response.status}
    body:   ${body}
  `);

  expect(response.status).toBe(403);
});

// a garbage refresh_token is also the CSRF identifier doubleCsrfProtection
// binds to. tampering with it invalidates the CSRF check
test('POST /auth/refresh invalid token', async () => {
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: 'refresh_token=not-a-real-jwt' },
  });
  const body = await response.text();

  console.log(`
    [POST /auth/refresh invalid token]
    status: ${response.status}
    body:   ${body}
  `);

  expect(response.status).toBe(403);
});

// refresh cookie without CSRF pair
test('POST /auth/refresh valid cookie no csrf', async () => {
  const { user, password } = await createUser();
  const { cookie, csrfCookie, csrfToken } = await loginWithCookie(user.email, password);

  const forged = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const forgedBody = await forged.text();

  const ok = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `${cookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken },
  });
  const okBody = (await ok.json()) as RefreshResponse;

  console.log(`
    [POST /auth/refresh valid cookie no csrf]
    forged: ${forged.status} ${forgedBody}
    ok:     ${ok.status}
  `);

  expect(forged.status).toBe(403);
  expect(ok.status).toBe(200);
  expect(okBody.accessToken).toBeTruthy();
});

// the browser attaches both cookies on its own, foreign JS cannot set the header
test('POST /auth/refresh both cookies no csrf header', async () => {
  const { user, password } = await createUser();
  const { cookie, csrfCookie } = await loginWithCookie(user.email, password);

  const forged = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `${cookie}; ${csrfCookie}` },
  });
  const forgedBody = await forged.text();

  console.log(`
    [POST /auth/refresh both cookies no csrf header]
    status: ${forged.status}
    body:   ${forgedBody}
  `);

  expect(forged.status).toBe(403);
});

// refreshing rotates the cookie and revokes the one that was spent.
// reusing the original after a successful refresh must fail
test('POST /auth/refresh rotates and revokes the old token', async () => {
  const { user, password } = await createUser();
  const { cookie: originalCookie, csrfCookie, csrfToken } =
    await loginWithCookie(user.email, password);
  const headers = { Cookie: `${originalCookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken };

  const first = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers });
  const firstBody = (await first.json()) as RefreshResponse;

  const reused = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers });
  const reusedBody = await reused.text();

  console.log(`
    [POST /auth/refresh rotation]
    first status:  ${first.status}
    reused status: ${reused.status} ${reusedBody}
  `);

  expect(first.status).toBe(200);
  expect(firstBody.accessToken).toBeTruthy();
  expect(reused.status).toBe(401);
});

// a user deactivated after logging in must be rejected on the next refresh
test('POST /auth/refresh inactive user', async () => {
  const { user, password } = await createUser();
  const { cookie, csrfCookie, csrfToken } = await loginWithCookie(user.email, password);
  await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `${cookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken },
  });
  const body = await response.text();

  console.log(`
    [POST /auth/refresh inactive user]
    status: ${response.status}
    user:   ${user.email}
    body:   ${body}
  `);

  expect(response.status).toBe(401);
});

// a rejected logout must leave the session usable, or forging one logs you out
test('POST /auth/logout both cookies no csrf header', async () => {
  const { user, password } = await createUser();
  const { cookie, csrfCookie, csrfToken } = await loginWithCookie(user.email, password);

  const forged = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { Cookie: `${cookie}; ${csrfCookie}` },
  });
  const forgedBody = await forged.text();

  const survived = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `${cookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken },
  });

  console.log(`
    [POST /auth/logout both cookies no csrf header]
    forged:   ${forged.status} ${forgedBody}
    survived: ${survived.status}
  `);

  expect(forged.status).toBe(403);
  expect(survived.status).toBe(200);
});

// the spent cookie must not survive the logout that revoked it
test('POST /auth/logout revokes the refresh token', async () => {
  const { user, password } = await createUser();
  const { cookie, csrfCookie, csrfToken } = await loginWithCookie(user.email, password);
  const headers = { Cookie: `${cookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken };

  const response = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers });
  const reused = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers });
  const reusedBody = await reused.text();

  console.log(`
    [POST /auth/logout revokes the refresh token]
    status: ${response.status}
    reused: ${reused.status} ${reusedBody}
  `);

  expect(response.status).toBe(204);
  expect(reused.status).toBe(401);
});
