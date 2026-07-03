import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';    // AES-256 in GCM — authenticated encryption
const IV_LENGTH = 12;               // 96 bits — GCM's standard IV size
const AUTH_TAG_LENGTH = 16;         // 128 bits — strongest forgery protection

const keyBuffer = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // parsed once, reused every call

/**
 * Encrypts a plaintext string with AES-256-GCM.
 *
 * A fresh random IV is generated on every call, so encrypting the same value
 * twice produces different ciphertext — preventing pattern analysis on stored data.
 *
 * The returned string is self-contained: it embeds the IV and GCM auth tag so
 * {@link decrypt} needs no extra arguments.
 *
 * @param plaintext - UTF-8 string to encrypt (e.g. a personnummer or bank account number)
 * @returns Base64-encoded `iv || authTag || ciphertext` (12 + 16 + n bytes)
 * @see {@link createCipheriv} — underlying Node.js primitive
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/**
 * Decrypts a payload produced by {@link encrypt}.
 *
 * GCM mode verifies the auth tag before returning plaintext.
 *
 * @param payload - Base64-encoded `iv || authTag || ciphertext` as returned by {@link encrypt}
 * @returns Decrypted UTF-8 string
 * @throws If the ciphertext or auth tag has been tampered with, rather than returning corrupt data
 * @see {@link createDecipheriv} — underlying Node.js primitive
 */
export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Returns a display-safe masked form of a bank account number.
 *
 * Only the last 4 digits are kept — all others are replaced with `****`.
 * This value is safe to store in plaintext and return in API responses.
 *
 * @param account - Raw account number; spaces are stripped before masking
 * @returns `****NNNN`, or `****` if the cleaned number is 4 digits or fewer
 */
export function maskBankAccount(account: string): string {
  const cleaned = account.replace(/\s+/g, '');
  if (cleaned.length <= 4) return '****';
  return `****${cleaned.slice(-4)}`;
}

/**
 * Produces a one-way SHA-256 fingerprint of a value for use in audit logs.
 *
 * The audit log records that a field changed — and can verify what it changed
 * to — without storing the plaintext value itself. Two hashes of the same
 * value will match; the original cannot be recovered from the hash.
 *
 * @param value - Plaintext value to fingerprint
 * @returns 64-character lowercase hex digest
 * @see {@link createHash} — underlying Node.js primitive
 */
export function hashForAudit(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
