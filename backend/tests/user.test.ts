import { faker } from '@faker-js/faker';
import { test, expect } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma';
import { Locale, UserRole } from '../prisma/generated/prisma/client';

const BCRYPT_COST = 12;

// direct db injection
test('createcustomer-bypassAPI', async () => {
  const pwraw = faker.internet.password();
  const pw = await bcrypt.hash(pwraw, BCRYPT_COST);

  const mockCustomerPayload = {
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    passwordHash: pw,
    locale: Locale.EN,
    role: UserRole.CUSTOMER,
    isActive: true,
  };

  const user = await prisma.user.create({ data: mockCustomerPayload });

  expect(user.id).toBeDefined();
  expect(user.email).toBe(mockCustomerPayload.email);
  expect(user.email).toBe(user.email.toLowerCase());
  expect(user.role).toBe(UserRole.CUSTOMER);
  expect(user.locale).toBe(Locale.EN);
  expect(user.isActive).toBe(true);
  expect(user.passwordHash).not.toBe(pwraw);
  await expect(bcrypt.compare(pwraw, user.passwordHash)).resolves.toBe(true);

  console.log(`
    [CUSTOMER CREATED]
    login: ${mockCustomerPayload.email}
    passw: ${pwraw} 
  `);
});
