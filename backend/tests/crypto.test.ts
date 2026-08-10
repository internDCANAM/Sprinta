import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { hashForAudit, maskBankAccount } from '../src/lib/crypto.js';

// only the last 4 digits are kept — all others become ****
test('mask last 4', () => {
  const input = '1234567890';
  const masked = maskBankAccount(input);

  console.log(`
    [mask last 4]
    in:  ${input}
    out: ${masked}
  `);

  expect(masked).toBe('****7890');
});

// spaces are stripped before masking
test('mask strips spaces', () => {
  const a = '3300 00 1234 56';
  const b = '  12 34 56  ';
  const maskedA = maskBankAccount(a);
  const maskedB = maskBankAccount(b);

  console.log(`
    [mask strips spaces]
    "${a}" -> ${maskedA}
    "${b}" -> ${maskedB}
  `);

  expect(maskedA).toBe('****3456');
  expect(maskedB).toBe('****3456');
});

// cleaned length ≤ 4 -> full mask, no digits leaked
test('mask short account', () => {
  const cases = ['1234', '12', '', '  1 2  '];
  const results = cases.map((c) => ({ in: c, out: maskBankAccount(c) }));

  console.log(`
    [mask short account]
    ${results.map((r) => `"${r.in}" -> ${r.out}`).join('\n    ')}
  `);

  for (const r of results) {
    expect(r.out).toBe('****');
  }
});

// one-way SHA-256 fingerprint — stable, 64-char lowercase hex
test('hash stable', () => {
  const value = 'SE1234567890123456789012';
  const hash = hashForAudit(value);
  const expected = createHash('sha256').update(value).digest('hex');

  console.log(`
    [hash stable]
    value:    ${value}
    hash:     ${hash}
    expected: ${expected}
  `);

  expect(hash).toBe(expected);
  expect(hash).toBe(hashForAudit(value));
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
});

// different inputs differ; plaintext never appears in the digest
test('hash not plaintext', () => {
  const a = 'account-a';
  const b = 'account-b';
  const hashA = hashForAudit(a);
  const hashB = hashForAudit(b);

  console.log(`
    [hash not plaintext]
    a: ${a} -> ${hashA}
    b: ${b} -> ${hashB}
  `);

  expect(hashA).not.toBe(hashB);
  expect(hashA).not.toBe(a);
  expect(hashA).not.toContain(a);
});
