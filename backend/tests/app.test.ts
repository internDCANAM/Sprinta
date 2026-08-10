import { afterAll, beforeAll, expect, test } from 'vitest';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { ErrorCode, type ApiErrorBody } from '../src/dto/error.js';
import { i18n } from '../src/middleware/i18n.middleware.js';
import { errorHandler } from '../src/utils/http.js';

const SECRET_ERROR = 'SECRET_STACK_TRACE_DO_NOT_LEAK';

// tiny app that only exercises errorHandler on an unhandled Error real
// createApp has no deliberate boom route — this keeps the probe out of prod
function createBoomApp(): Express {
  const app = express();
  app.use(cookieParser());
  app.use(i18n);
  app.get('/api/v1/boom', (_req, _res, next) => {
    next(new Error(SECRET_ERROR));
  });
  app.use(errorHandler);
  return app;
}

let appServer: Server;
let boomServer: Server;
let baseUrl: string;
let boomUrl: string;

// starts createApp for helmet/cors and a boom app for errorHandler leakage
beforeAll(async () => {
  appServer = createServer(createApp());
  await new Promise<void>((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(appServer.address() as AddressInfo).port}/api/v1`;

  boomServer = createServer(createBoomApp());
  await new Promise<void>((resolve) => boomServer.listen(0, '127.0.0.1', resolve));
  boomUrl = `http://127.0.0.1:${(boomServer.address() as AddressInfo).port}/api/v1`;
});

// closes both servers after tests run
afterAll(async () => {
  await new Promise<void>((resolve) => appServer.close(() => resolve()));
  await new Promise<void>((resolve) => boomServer.close(() => resolve()));
});

// helmet should stamp security headers on every response
test('GET /health helmet headers', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const headers = {
    'x-content-type-options': response.headers.get('x-content-type-options'),
    'x-frame-options': response.headers.get('x-frame-options'),
    'x-dns-prefetch-control': response.headers.get('x-dns-prefetch-control'),
    'strict-transport-security': response.headers.get('strict-transport-security'),
  };
  const body = await response.text();

  console.log(`
    [GET /health helmet headers]
    status:  ${response.status}
    headers: ${JSON.stringify(headers)}
    body:    ${body}
  `);

  expect(response.status).toBe(200);
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  expect(headers['x-dns-prefetch-control']).toBe('off');
});

// cors reflects the configured origin when the request sends it
test('GET /health cors origin', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { Origin: env.CORS_ORIGIN },
  });
  const allowOrigin = response.headers.get('access-control-allow-origin');
  const allowCreds = response.headers.get('access-control-allow-credentials');
  const body = await response.text();

  console.log(`
    [GET /health cors origin]
    status:       ${response.status}
    Origin:       ${env.CORS_ORIGIN}
    allow-origin: ${allowOrigin}
    credentials:  ${allowCreds}
    body:         ${body}
  `);

  expect(response.status).toBe(200);
  expect(allowOrigin).toBe(env.CORS_ORIGIN);
  expect(allowCreds).toBe('true');
});

// preflight must allow the configured origin and credentials
test('OPTIONS /health cors preflight', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: env.CORS_ORIGIN,
      'Access-Control-Request-Method': 'GET',
    },
  });
  const allowOrigin = response.headers.get('access-control-allow-origin');
  const allowCreds = response.headers.get('access-control-allow-credentials');
  const allowMethods = response.headers.get('access-control-allow-methods');

  console.log(`
    [OPTIONS /health cors preflight]
    status:        ${response.status}
    allow-origin:  ${allowOrigin}
    credentials:   ${allowCreds}
    allow-methods: ${allowMethods}
  `);

  expect(response.status).toBe(204);
  expect(allowOrigin).toBe(env.CORS_ORIGIN);
  expect(allowCreds).toBe('true');
});

// unhandled Error return generic 500
// message and stack should not reach the client
test('errorHandler no leakage', async () => {
  const response = await fetch(`${boomUrl}/boom`);
  const bodyText = await response.text();
  const body = JSON.parse(bodyText) as ApiErrorBody;

  console.log(`
    [errorHandler no leakage]
    status: ${response.status}
    body:   ${bodyText}
  `);

  expect(response.status).toBe(500);
  expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
  expect(body.statusCode).toBe(500);
  expect(body.error).toBeTruthy();
  expect(bodyText).not.toContain(SECRET_ERROR);
  expect(bodyText.toLowerCase()).not.toContain('stack');
  expect(body).not.toHaveProperty('stack');
});
