import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, expect, test } from 'vitest';
import bcrypt from 'bcrypt';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import type { RegisterInput, UserProfile } from '../src/dto/user.js';

let server: Server;
let baseUrl: string;

// starts a local server so tests hit real endpoints, not handlers directly
// clears leftover register-limit counters so this run isn't already capped
beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const counters = await redis.keys('rl:register:*');
  if (counters.length) await redis.del(...counters);
});

// closes the server after tests run
// still runs if beforeAll failed — close()'s error callback is ignored
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  redis.disconnect();
});

// user input fields
// .email.toUpperCase() to prove it's always lowercased on the way in
// (dto/user.ts, profileFields.email)
function userInput(): RegisterInput {
  return {
    email: faker.internet.email().toUpperCase(),
    password: faker.internet.password({ length: 16 }),
    name: faker.person.fullName(),
    phone: faker.phone.number(),
    addressStreet: faker.location.streetAddress(),
    addressPostal: faker.location.zipCode(),
    addressCity: faker.location.city(),
  };
}

// basic user creation via actual api with `fetch` function
// POST /auth/register -> register() in routes/auth.ts
test('register creates user', async () => {
  const input = userInput();
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  expect(response.status).toBe(201);

  const profile = (await response.json()) as UserProfile;
  expect(profile.id).toBeDefined();
  expect(profile.email).toBe(input.email.toLowerCase());
  expect(profile.name).toBe(input.name);
  expect(profile.addressCity).toBe(input.addressCity);
  expect(profile.isAdmin).toBe(false);
  expect(profile.bankAccountMasked).toBeNull();
  expect(profile).not.toHaveProperty('passwordHash');

  const stored = await prisma.user.findUniqueOrThrow({ where: { id: profile.id } });
  expect(stored.email).toBe(input.email.toLowerCase());
  expect(stored.passwordHash).not.toBe(input.password);
  await expect(bcrypt.compare(input.password, stored.passwordHash)).resolves.toBe(true);
  expect(stored.isActive).toBe(true);

  console.log(`
    [USER CREATED]
    login: ${profile.email}
    passw: ${input.password}
  `);
});

// a second registration with an already-used email must not create a row
test('reject taken email', async () => {
  const input = userInput();
  const first = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  expect(first.status).toBe(201);

  const retry = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...userInput(), email: input.email }),
  });
  expect(retry.status).toBe(409);
  expect(await prisma.user.count({ where: { email: input.email.toLowerCase() } })).toBe(1);
});

// an invalid payload must be rejected before anything is written to the db
test('reject registration = no db entry', async () => {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-address', password: 'short', name: '' }),
  });
  expect(response.status).toBe(400);
  expect(await prisma.user.count({ where: { name: '' } })).toBe(0);
});
