import { afterAll, beforeAll, expect, test } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { Source, validate } from '../src/middleware/validate.js';

const pagination = z.object({ page: z.coerce.number().int().min(1) });

let server: Server;
let baseUrl: string;

// bare express app. 
// this middleware is independent of router so there is no db/redis to stand up
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.get('/query', validate(pagination, Source.QUERY), (req, res) => { res.json(req.query); });
  app.post('/body', validate(pagination, Source.BODY), (req, res) => { res.json(req.body); });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('replaces req.query with the coerced value', async () => {
  const response = await fetch(`${baseUrl}/query?page=2`);
  const body = (await response.json()) as { page: number; };

  console.log(`
    [replaces req.query with the coerced value]
    status: ${response.status}
    body:   ${JSON.stringify(body)}
  `);

  expect(response.status).toBe(200);
  expect(body.page).toBe(2);
});

// body has no getter, so the plain assignment still works
test('replaces req.body with the coerced value', async () => {
  const response = await fetch(`${baseUrl}/body`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: '3' }),
  });
  const body = (await response.json()) as { page: number; };

  console.log(`
    [replaces req.body with the coerced value]
    status: ${response.status}
    body:   ${JSON.stringify(body)}
  `);

  expect(response.status).toBe(200);
  expect(body.page).toBe(3);
});
