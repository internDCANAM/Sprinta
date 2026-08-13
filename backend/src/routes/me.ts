import bcrypt from 'bcrypt';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler, conflict, unauthorized } from '../utils/http.js';
import { encrypt, maskBankAccount } from '../lib/crypto.js';
import { auditChanges } from '../utils/securityEvents.js';
import type { AuthenticatedRequest } from '../utils/auth.js';
import { bankAccountPatchSchema, deactivateAccountSchema, profilePatchSchema, userProfileSchema, type UserProfile } from '../dto/user.js';

/**
 * The three columns a plaintext bank account expands into — the encrypted value
 * to decrypt later, the masked value safe to return, and the change timestamp.
 * Shared by {@link editProfile} and {@link editBankAccount} so the encrypt/mask
 * pairing lives in one place.
 */
function bankAccountData(bankAccount: string) {
  return {
    bankAccountEncrypted: encrypt(bankAccount),
    bankAccountMasked: maskBankAccount(bankAccount),
    bankAccountUpdatedAt: new Date(),
  };
}

async function readProfile(req: AuthenticatedRequest): Promise<UserProfile> {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  return userProfileSchema.parse(user);
}

async function editProfile(req: AuthenticatedRequest): Promise<UserProfile> {
  const { bankAccount, ...input } = profilePatchSchema(req.t).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

  if (input.email !== undefined && input.email !== user?.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email } });
    if (taken) throw conflict(req, req.t.input.emailTaken);
  }

  const data = { ...input, ...(bankAccount !== undefined ? bankAccountData(bankAccount) : {}) };

  const updated = await prisma.user.update({ where: { id: req.user.userId }, data });
  await auditChanges({
    tableName: 'users',
    recordId: req.user.userId,
    changedBy: req.user.userId,
    before: user!,
    patch: data,
    req,
  });

  return userProfileSchema.parse(updated);
}

/**
 * Bank-account-only update behind its own endpoint so the payload can't carry
 * any other profile field. Otherwise identical to the bank branch of
 * {@link editProfile}: encrypt, mask, stamp, audit.
 */
async function editBankAccount(req: AuthenticatedRequest): Promise<UserProfile> {
  const { bankAccount } = bankAccountPatchSchema(req.t).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  const data = bankAccountData(bankAccount);

  const updated = await prisma.user.update({ where: { id: req.user.userId }, data });
  await auditChanges({
    tableName: 'users',
    recordId: req.user.userId,
    changedBy: req.user.userId,
    before: user!,
    patch: data,
    req,
  });

  return userProfileSchema.parse(updated);
}

/**
 * Deactivation only flips `isActive`; the login and refresh guards already
 * reject an inactive user, so no session/token needs unwinding here. The
 * current password is re-checked so a hijacked access token alone cannot do it.
 */
async function deactivateAccount(req: AuthenticatedRequest): Promise<UserProfile> {
  const { password } = deactivateAccountSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!(await bcrypt.compare(password, user!.passwordHash))) {
    throw unauthorized(req, req.t.auth.invalidCredentials);
  }

  const updated = await prisma.user.update({
    where: { id: req.user.userId },
    data: { isActive: false },
  });
  await auditChanges({
    tableName: 'users',
    recordId: req.user.userId,
    changedBy: req.user.userId,
    before: user!,
    patch: { isActive: false },
    req,
  });

  return userProfileSchema.parse(updated);
}

export const meRouter = Router();
meRouter.use(authMiddleware);
meRouter.get('/', asyncHandler<AuthenticatedRequest>(async (req, res) => res.json(await readProfile(req))));
meRouter.patch('/', asyncHandler<AuthenticatedRequest>(async (req, res) => res.json(await editProfile(req))));
meRouter.put('/bank-account', asyncHandler<AuthenticatedRequest>(async (req, res) => res.json(await editBankAccount(req))));
meRouter.post('/deactivate', asyncHandler<AuthenticatedRequest>(async (req, res) => res.json(await deactivateAccount(req))));
