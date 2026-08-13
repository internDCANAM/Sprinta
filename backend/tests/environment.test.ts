import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { env } from '../src/config/env.js';
import type { LoginResponse } from '../src/dto/user.js';
import type { User } from '../prisma/generated/prisma/client.js';

const BCRYPT_COST = 12;
const BLACKHOLE_PORT = 1;
const RETRY_STEP_MS = 50;

const saved = {
  maxRetriesPerRequest: redis.options.maxRetriesPerRequest,
  retryStrategy: redis.options.retryStrategy,
  host: redis.options.host,
  port: redis.options.port,
  connectTimeout: redis.options.connectTimeout,
};

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

// timed login so REDIS_MAX_RETRIES comparisons can measure fail speed
async function loginRaw(email: string, password: string):
  Promise<{ status: number; body: string; ms: number; }> {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.text();
  const ms = performance.now() - started;
  return { status: response.status, body, ms };
}

// wait until redis reports one of the given statuses (or timeout)
async function waitForStatus(statuses: string[], timeoutMs = 3000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (statuses.includes(redis.status)) return redis.status;
    await new Promise((r) => setTimeout(r, 10));
  }
  return redis.status;
}

// stop reconnect loops, restore host/port/options, connect to real redis again
async function restoreRedis(): Promise<void> {
  redis.options.retryStrategy = () => undefined;

  if (redis.status !== 'end' && redis.status !== 'wait') redis.disconnect();
  await waitForStatus(['end', 'wait'], 2000);

  redis.options.maxRetriesPerRequest = saved.maxRetriesPerRequest;
  redis.options.retryStrategy = saved.retryStrategy;
  redis.options.host = saved.host;
  redis.options.port = saved.port;
  redis.options.connectTimeout = saved.connectTimeout;

  if (redis.status !== 'ready') await redis.connect();
  await waitForStatus(['ready'], 3000);

  console.log(`
    [REDIS RESTORED]
    status:     ${redis.status}
    host:port:  ${String(redis.options.host)}:${String(redis.options.port)}
    maxRetries: ${String(redis.options.maxRetriesPerRequest)}
  `);
}

// point the live redis client at a black-hole port and force a reconnect loop
// disconnect(true) does not set manuallyClosing, so ioredis will reconnect then
// hit real POST /auth/login — rate-limit store uses redis.call on this client
async function loginWithBrokenRedis(maxRetries: number, email: string, password: string) {
  await restoreRedis();
  redis.options.maxRetriesPerRequest = maxRetries;
  redis.options.host = '127.0.0.1';
  redis.options.port = BLACKHOLE_PORT;
  redis.options.connectTimeout = 100;
  redis.options.retryStrategy = (times: number) => {
    const delay = Math.min(times * RETRY_STEP_MS, 200);
    console.log(`
      [retryStrategy]
      attempt:    ${times}
      delayMs:    ${delay}
      maxRetries: ${String(redis.options.maxRetriesPerRequest)}
      status:     ${redis.status}
    `);
    return delay;
  };

  const errors: string[] = [];
  const onError = (err: Error) => {
    errors.push(err.message);
    console.log(`[redis error] ${err.message}`);
  };
  redis.on('error', onError);

  console.log(`
    [BREAK REDIS]
    maxRetries:          ${maxRetries}
    target:              127.0.0.1:${BLACKHOLE_PORT}
    status before break: ${redis.status}
  `);

  redis.disconnect(true);
  await waitForStatus(['reconnecting', 'connecting', 'close'], 1000);
  console.log(`
    [BREAK REDIS]
    status after break: ${redis.status}
  `);

  let result: { status: number; body: string; ms: number; };
  try {
    result = await loginRaw(email, password);
  } finally {
    redis.off('error', onError);
  }

  console.log(`
    [LOGIN WITH BROKEN REDIS]
    maxRetries: ${maxRetries}
    status:     ${result.status}
    ms:         ${result.ms.toFixed(1)}
    body:       ${result.body}
    redis errors (${errors.length}):${errors.length
  ? errors.map((e) => `\n      - ${e}`).join('')
  : ' (none)'}
  `);

  await restoreRedis();
  return result;
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

  console.log(`
    [SETUP]
    baseUrl:                            ${baseUrl}
    env.REDIS_URL:                      ${env.REDIS_URL}
    env.REDIS_MAX_RETRIES:              ${env.REDIS_MAX_RETRIES}
    redis.options.maxRetriesPerRequest: ${String(redis.options.maxRetriesPerRequest)}
    redis.status:                       ${redis.status}
    redis host:port:                    ${String(redis.options.host)}:${String(redis.options.port)}
  `);
});

// restore redis, then close the server still runs if beforeAll failed —
// close()'s error callback is ignored, so this never throws
afterAll(async () => {
  await restoreRedis();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  redis.disconnect();
});

// baseline — healthy login path uses redis without chaos
test('POST /auth/login healthy', async () => {
  const { user, password } = await createUser();
  const result = await loginRaw(user.email, password);
  const parsed = JSON.parse(result.body) as LoginResponse;

  console.log(`
    [POST /auth/login healthy]
    email:  ${user.email}
    status: ${result.status}
    ms:     ${result.ms.toFixed(1)}
    body:   ${result.body}
  `);

  expect(result.status).toBe(200);
  expect(parsed.accessToken).toBeDefined();
});

// maxRetriesPerRequest is wired from env.
// higher retries fail slower when redis is down
test('REDIS_MAX_RETRIES fail speed', async () => {
  const { user, password } = await createUser();

  console.log(`
    [WIRING]
    redis.options.maxRetriesPerRequest === env.REDIS_MAX_RETRIES (${env.REDIS_MAX_RETRIES})
  `);
  expect(redis.options.maxRetriesPerRequest).toBe(env.REDIS_MAX_RETRIES);

  const with0 = await loginWithBrokenRedis(0, user.email, password);
  const with3 = await loginWithBrokenRedis(3, user.email, password);

  console.log(`
    [COMPARE]
    maxRetries=0 -> status=${with0.status} ms=${with0.ms.toFixed(1)}
    body: ${with0.body}

    maxRetries=3 -> status=${with3.status} ms=${with3.ms.toFixed(1)}
    body: ${with3.body}

    delta ms (3 - 0): ${(with3.ms - with0.ms).toFixed(1)}
  `);

  expect(with0.status).toBe(500);
  expect(with3.status).toBe(500);
  expect(with3.ms).toBeGreaterThan(with0.ms);
});
