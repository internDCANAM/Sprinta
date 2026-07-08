import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import { asyncHandler, conflict, notFound } from '../utils/http.js';
import { encrypt, maskBankAccount } from '../lib/crypto.js';
import { writeAudit } from '../utils/securityEvents.js';
import type { AuthenticatedRequest } from '../utils/auth.js';

export const getUpdateProfileSchema = (req: Request) => {
  return z
    .object({
      name:          z.string().min(1).max(200).optional(),
      email:         z.string().email().optional(),
      phone:         z.string().max(40).optional(),
      addressStreet: z.string().max(200).optional(),
      addressPostal: z.string().max(20).optional(),
      addressCity:   z.string().max(100).optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, {
      message: req.t.input.validationFailed,
    });
};

export const meRouter = Router();

meRouter.use(authMiddleware, roleMiddleware(['CUSTOMER']));

meRouter.get(
  '/',
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.userId },
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true, createdAt: true },
        },
      },
    });
    if (!customer) throw notFound(req, req.t.db.customerProfileMissing);

    res.json({
      id: customer.id,
      user: customer.user,
      address: {
        street: customer.addressStreet,
        postal: customer.addressPostal,
        city: customer.addressCity,
      },
      phone: customer.phone,
      bankAccountMasked: customer.bankAccountMasked,
      bankAccountUpdatedAt: customer.bankAccountUpdatedAt,
      createdAt: customer.createdAt,
    });
  })
);

const UPDATABLE_CUSTOMER_FIELDS = [
  'phone',
  'addressStreet',
  'addressPostal',
  'addressCity',
] as const;

meRouter.patch(
  '/',
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const schema = getUpdateProfileSchema(req);
    const userId = req.user.userId;
    const input = req.body as z.infer<typeof schema>;
    const existing = await prisma.customer.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!existing) throw notFound(req, req.t.db.customerProfileMissing);

    if (input.email && input.email.toLowerCase() !== existing.user.email) {
      const taken = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (taken) throw conflict(req, req.t.input.emailTaken);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const userUpdate: { name?: string; email?: string } = {};
      if (input.name !== undefined) userUpdate.name = input.name;
      if (input.email !== undefined) userUpdate.email = input.email.toLowerCase();
      const user = Object.keys(userUpdate).length
        ? await tx.user.update({ where: { id: userId }, data: userUpdate })
        : existing.user;

      const customerUpdate: Partial<
        Record<(typeof UPDATABLE_CUSTOMER_FIELDS)[number], string | null>
      > = {};
      if (input.phone !== undefined) customerUpdate.phone = input.phone;
      if (input.addressStreet !== undefined) customerUpdate.addressStreet = input.addressStreet;
      if (input.addressPostal !== undefined) customerUpdate.addressPostal = input.addressPostal;
      if (input.addressCity !== undefined) customerUpdate.addressCity = input.addressCity;

      const customer = Object.keys(customerUpdate).length
        ? await tx.customer.update({
            where: { id: existing.id },
            data: customerUpdate,
          })
        : existing;

      return { user, customer };
    });

    // One audit log entry per changed field.
    const auditOps: Promise<void>[] = [];
    if (input.name !== undefined && input.name !== existing.user.name) {
      auditOps.push(
        writeAudit({
          tableName: 'users',
          recordId: userId,
          changedBy: userId,
          fieldName: 'name',
          oldValue: existing.user.name,
          newValue: input.name,
          req,
        })
      );
    }
    if (input.email !== undefined && input.email.toLowerCase() !== existing.user.email) {
      auditOps.push(
        writeAudit({
          tableName: 'users',
          recordId: userId,
          changedBy: userId,
          fieldName: 'email',
          oldValue: existing.user.email,
          newValue: input.email.toLowerCase(),
          req,
        })
      );
    }
    for (const field of UPDATABLE_CUSTOMER_FIELDS) {
      const next = input[field];
      const prev = existing[field];
      if (next !== undefined && next !== prev) {
        auditOps.push(
          writeAudit({
            tableName: 'customers',
            recordId: existing.id,
            changedBy: userId,
            fieldName: field,
            oldValue: prev ?? null,
            newValue: next,
            req,
          })
        );
      }
    }
    await Promise.all(auditOps);

    res.json({
      id: updated.customer.id,
      name: updated.user.name,
      email: updated.user.email,
      phone: updated.customer.phone,
      address: {
        street: updated.customer.addressStreet,
        postal: updated.customer.addressPostal,
        city: updated.customer.addressCity,
      },
    });
  })
);

export const BankAccountSchema = (req: Request) => {
  return z.object({
    bankAccount: z
      .string()
      .min(4)
      .max(40)
      .regex(/^[0-9 \-]+$/, req.t.format.regex),
  });
};

meRouter.put(
  '/bank-account',
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const schema = BankAccountSchema(req);
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.flatten().fieldErrors,
      });
    }

    const { bankAccount } = parsed.data;

    const userId = req.user.userId;
    const customer = await prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw notFound(req, req.t.db.customerProfileMissing);

    const encrypted = encrypt(bankAccount);
    const masked = maskBankAccount(bankAccount);
    const now = new Date();

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        bankAccountEncrypted: encrypted,
        bankAccountMasked: masked,
        bankAccountUpdatedAt: now,
      },
    });

    await writeAudit({
      tableName: 'customers',
      recordId: customer.id,
      changedBy: userId,
      fieldName: 'bank_account_encrypted',
      oldValue: customer.bankAccountEncrypted,
      newValue: encrypted,
      req,
    });

    res.json({
      bankAccountMasked: updated.bankAccountMasked,
      bankAccountUpdatedAt: updated.bankAccountUpdatedAt,
    });
  })
);
