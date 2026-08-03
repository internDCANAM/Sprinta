import { z } from 'zod';
import type { Prisma } from '../../prisma/generated/prisma/client.js';
import type { Locale, Translations } from '../lib/i18n.js';
import { isoDate, isoDateOrNull } from './primitives.js';

const profileFields = {
  name:          z.string().min(1).max(200),
  email:         z.string().email().toLowerCase(),
  phone:         z.string().max(40).optional(),
  addressStreet: z.string().max(200).optional(),
  addressPostal: z.string().max(20).optional(),
  addressCity:   z.string().max(100).optional(),
};

export const registerInputSchema = z.object({
  ...profileFields,
  password: z.string().min(8).max(200),
});

export const loginInputSchema = z.object({
  email: profileFields.email,
  password: z.string().min(1),
});

export const deactivateAccountSchema = z.object({
  password: z.string().min(1),
});

function bankAccountField(t: Translations) {
  return z.string().min(4).max(40).regex(/^[0-9 \-]+$/, t.format.regex);
}

export function profilePatchSchema(t: Translations) {
  return z
    .object({
      ...profileFields,
      bankAccount: bankAccountField(t),
    })
    .partial()
    .refine((patch) => Object.keys(patch).length > 0, { message: t.input.validationFailed });
}

export function bankAccountPatchSchema(t: Translations) {
  return z.object({ bankAccount: bankAccountField(t) });
}

export const userProfileSchema = z.object({
  id: z.string(),
  isAdmin: z.boolean(),
  email: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  addressStreet: z.string().nullable(),
  addressPostal: z.string().nullable(),
  addressCity: z.string().nullable(),
  bankAccountMasked: z.string().nullable(),
  bankAccountUpdatedAt: isoDateOrNull,
  createdAt: isoDate,
});

export const adminUserRowInclude = {
  _count: { select: { deals: true, properties: true } },
} satisfies Prisma.UserInclude;

export const adminUserRowSchema = z
  .object({
    id: z.string(),
    isAdmin: z.boolean(),
    email: z.string(),
    name: z.string(),
    isActive: z.boolean(),
    createdAt: isoDate,
    _count: z.object({ deals: z.number(), properties: z.number() }),
  })
  .transform((u) => ({
    id: u.id,
    isAdmin: u.isAdmin,
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    createdAt: u.createdAt,
    dealCount: u._count.deals,
    propertyCount: u._count.properties,
  }));

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>;
export type ProfilePatch = z.infer<ReturnType<typeof profilePatchSchema>>;
export type UpdateProfileInput = Omit<ProfilePatch, 'bankAccount'>;
export type UpdateBankAccountInput = z.infer<ReturnType<typeof bankAccountPatchSchema>>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type AdminUserRow = z.infer<typeof adminUserRowSchema>;

export interface AuthUser {
  id: string;
  locale: Locale;
  email: string;
  name: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
}
