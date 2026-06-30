# ISO/IEC 27001: Developer Guidelines

**ISO/IEC 27001** is the international standard for Information Security 
Management Systems (ISMS). For web developers handling databases and Personally 
Identifiable Information (PII), ISO 27001 translates high-level security 
policies into concrete, verifiable engineering practices.

Instead of vague promises, compliance requires a systematic approach to risk. 
As a developer, this means weaving security directly into the architecture:

- **Data Protection (At Rest & In Transit):** Mandating authenticated
  encryption (e.g., AES-256-GCM) for sensitive database columns, enforcing
  HTTPS/HSTS, and strictly masking PII in API responses.
- **Identity & Access Management:** Implementing robust password hashing 
  (bcrypt), secure session lifecycles (httpOnly cookies, token rotation), and 
  enforcing Role-Based Access Control (RBAC) at the middleware layer.
- **Auditing & Traceability:** Building tamper-evident audit logs that track 
  state changes without leaking plaintext PII into monitoring tools.
- **Defensive Architecture:** Utilizing global security headers, strict CORS 
  policies, input validation, and rate limiting to neutralize common attack 
  vectors like XSS, CSRF, and brute forcing.
- **Continuous Lifecycle Management:** Actively monitoring dependencies for 
  vulnerabilities (CVEs), securely managing environment secrets, and aligning 
  database retention constraints with privacy laws like GDPR.

Ultimately, ISO 27001 requires developers to prove that security controls are 
explicitly designed, continuously monitored, and consistently applied across 
the entire application lifecycle.

## What is covered

### A.8.5 Secure Authentication

Passwords are hashed with **`bcrypt`**[^1] at cost factor 12 in
[`auth.ts`](backend/src/routes/auth.ts) and
[`seed.ts`](backend/prisma/seed.ts). **Access tokens**[^2] expire after
**15 min** (`JWT_ACCESS_TTL`[^3]) and are held only in memory on the client via
[`tokenStore.ts`](frontend/src/auth/tokenStore.ts) — never written to
`localStorage`. Refresh tokens live in **Redis**[^4] and are rotated on every
use, so a stolen token is invalidated the moment the legitimate user next
refreshes. They are delivered as **`httpOnly`** cookies with
`sameSite: lax`[^5], blocking the most common **XSS/CSRF**[^6] token-theft
vectors.

```ts
// routes/auth.ts — cookie configuration on every login and refresh
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/v1/auth",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}

// routes/auth.ts — token rotation: old revoked before new is issued
await revokeRefreshToken(payload.userId, payload.tokenId);
const { token: newRefresh, tokenId: newTokenId } = signRefreshToken(user.id);
await storeRefreshToken(user.id, newTokenId);

// seed.ts / routes/auth.ts — bcrypt at cost factor 12
const hash = await bcrypt.hash(password, 12);
```

### A.8.24 Use of Cryptography

**PII**[^10] — personnummer and bank account numbers — is encrypted at rest
with **AES-256-GCM**[^7] in [`crypto.ts`](backend/src/lib/crypto.ts). GCM mode
provides authenticated encryption: any tampering with stored ciphertext is
detected at decryption time. A new **IV** is generated on every call,
preventing identical plaintexts from producing identical ciphertext.
`maskBankAccount` produces a safe display value (`****4567`) that is stored
alongside the encrypted form and used everywhere the full number is not
required.

```ts
// lib/crypto.ts
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);                       // unique per call
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();                     // tamper detection
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function maskBankAccount(account: string): string {
  const cleaned = account.replace(/\s+/g, "");
  return cleaned.length <= 4 ? "****" : `****${cleaned.slice(-4)}`;
}
```

### A.8.11 Data Masking

`bankAccountMasked` (e.g. `****4567`) is the only form of the account number
returned in API responses and displayed in the UI. `bankAccountEncrypted` holds
the AES-256-GCM ciphertext and is never surfaced — it is decrypted only when
the raw account number is explicitly required, not on every read.

### A.8.3 / A.5.15 Access Control and Information Access Restriction

A three-tier role enum (`CUSTOMER`, `ADMIN`, `SUPERADMIN`) defined in
[`enums.ts`](shared/src/enums.ts) is enforced at the middleware layer via
`roleMiddleware` in [`auth.ts`](backend/src/middleware/auth.ts). Customer
routes also pass through `dealOwnershipMiddleware` in
[`ownership.ts`](backend/src/middleware/ownership.ts), which verifies that the
requested deal belongs to the authenticated customer. `/admin` routes block
customers; `/me`, `/deals`, and `/payments` block admins — privilege escalation
in either direction is not possible.

```ts
// middleware/auth.ts — role gate applied at the router level
export function roleMiddleware(allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) return next(forbidden());
    next();
  };
}

// middleware/ownership.ts — secondary ownership check on deal routes
if (req.user.role === "CUSTOMER") {
  if (!req.user.customerId || deal.customerId !== req.user.customerId) {
    return next(forbidden());
  }
}
```

### A.8.15 Logging

**Winston**[^8] is configured in [`logger.ts`](backend/src/lib/logger.ts) with
structured JSON output in production and human-readable format in development.
Authentication events are logged with `userId` and `role` in
[`auth.ts`](backend/src/routes/auth.ts). Field-level changes are recorded
in the `audit_log` table via [`audit.ts`](backend/src/utils/audit.ts) as pairs
of **SHA-256**[^9] hashes rather than the values themselves — the audit trail
proves a value changed without the log becoming a second location storing
**PII**[^10] in plaintext.

```ts
// routes/auth.ts — structured login event
logger.info("Inloggning lyckades", { userId: user.id, role: user.role });

// utils/audit.ts — values stored as hashes only
await prisma.auditLog.create({
  data: {
    fieldName: entry.fieldName,
    oldValueHash: entry.oldValue ? hashForAudit(entry.oldValue) : null,
    newValueHash: entry.newValue ? hashForAudit(entry.newValue) : null,
    ipAddress: (entry.req.ip ?? "unknown").toString(),
    userAgent: entry.req.get("user-agent") ?? "unknown",
  },
});
```

### A.8.25 / A.8.26 Network Security and Application Security

**Helmet.js**[^11] is applied globally in [`app.ts`](backend/src/app.ts),
setting security headers including **HSTS**[^12] and **CSP**[^13]
automatically. **CORS**[^14] is locked to the origin list from `CORS_ORIGIN`.
All request bodies pass through **Zod**[^15] schemas before reaching the
database. The `/auth/login` endpoint is rate-limited to 10 requests per minute
via a **Redis**[^4]-backed store in
[`rateLimit.ts`](backend/src/middleware/rateLimit.ts).

```ts
// app.ts — global security middleware
app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// middleware/rateLimit.ts — Redis-backed limiter on the login route
export const loginRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  store: new RedisStore({
    sendCommand: (cmd: string, ...args: string[]) =>
      redis.call(cmd, ...args) as Promise<never>,
  }),
});
```

## What is not addressed

Not all of these are coding tasks — some are policy/process, but ISO 27001
covers both.

### A.8.8 Management of Technical Vulnerabilities

No dependency scanning is configured. ISO 27001 requires a defined process for
identifying and patching known vulnerabilities in third-party components. The
project uses `jsonwebtoken`, `bcrypt`, `axios`, and `express` — all actively
maintained, but without automated scanning a published **CVE**[^19] against any
of them goes unnoticed until someone manually runs `npm audit`[^16]. Adding
**Dependabot**[^17] to the repository or integrating **Snyk**[^18] into CI
would close this gap with no application code changes required.

### A.8.15 / A.8.16 Log Retention and Monitoring

The logger is in place but there is no defined policy for where logs go in
production, how long they are retained, or who reviews them. ISO 27001 requires
that logs are protected from tampering, kept for a defined period, and that
anomalous events generate alerts. The **Redis**[^4] rate limiter correctly
returns HTTP `429`[^20] when the login threshold is crossed, but the event
triggers no alert and leaves no durable record — it happens silently. 

### A.5.34 Privacy and Protection of PII

`ON DELETE CASCADE`[^21] on the `customers` table propagates a user deletion
through deals, messages, and payments — satisfying the GDPR right to erasure 
(Article 17[^23]). However, `audit_log` uses `ON DELETE RESTRICT`[^22] on its
foreign key to `users`, meaning ***a user with audit entries cannot be 
hard-deleted***. This is a direct conflict requiring either a soft-delete
strategy on `users` or anonymization of audit entries before hard deletion.
There is also no data retention policy: how long are deals kept after 
`AVSLUTAD`? How long are messages stored? GDPR Article 5[^24] requires that
personal data is not kept longer than necessary for the purpose it was
collected.

```sql
-- migrations/20260422093120_init/migration.sql
-- The constraint that blocks user deletion while audit entries exist:
ALTER TABLE "audit_log"
  ADD CONSTRAINT "audit_log_changed_by_fkey"
    FOREIGN KEY ("changed_by")
    REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
```

### A.8.28 Secure Coding

`getKey()` in [`crypto.ts`](backend/src/lib/crypto.ts) reads and parses
`ENCRYPTION_KEY` from `process.env` on every call to `encrypt()` and
`decrypt()`. The env schema in [`env.ts`](backend/src/config/env.ts) validates
the key at startup, but if `crypto.ts` is ever imported before that validation
runs, misconfiguration surfaces as a runtime throw during an encrypt/decrypt
call rather than a clear startup failure. Parsing the key once at module load
time would catch any misconfiguration immediately on boot.

```ts
// lib/crypto.ts — current: env read on every encrypt/decrypt call
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY saknas i miljövariabler");
  return Buffer.from(hex, "hex");
}
```

### A.8.5 Session Timeout / Token Revocation on Logout from All Devices

`revokeAllRefreshTokens()` is fully implemented in
[`auth.ts`](backend/src/utils/auth.ts), scanning Redis for every active session
belonging to a user and deleting them. It is never called. No UI button or API
endpoint exposes it. If an account is compromised, an attacker holding a valid
refresh token retains access for the full 30-day TTL with no way for the user
or admin to cut it short.

```ts
// utils/auth.ts — implemented but never called from any route
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  const stream = redis.scanStream({ 
    match: `refresh:${userId}:*`, 
    count: 100 
  });
  for await (const keys of stream) {
    if (keys.length) await redis.del(...keys);
  }
}
```

### A.8.12 Data Leakage

`/api/v1/me` in [`me.ts`](backend/src/routes/me.ts) explicitly selects only
the fields needed, so `personalIdEncrypted` and `bankAccountEncrypted` are 
never returned. The admin customer list in
[`admin.ts`](backend/src/routes/admin.ts) uses a broad `include` with no 
field-level `select` on the customer object, meaning every column on the 
`customers` row — including encrypted fields — is currently returned to the 
frontend. Any new sensitive column added to that table would be exposed 
automatically until an explicit `select` is added.

```ts
// routes/admin.ts — current: no select on customer, encrypted fields exposed
prisma.customer.findMany({
  include: {
    user: { select: { id: true, name: true, email: true, isActive: true } },
    _count: { select: { deals: true, properties: true } },
    // customer row itself has no select — bankAccountEncrypted etc. leak here
  },
});
```

### A.8.13 Information Backup

No automated backup strategy for the database or Redis state exists. 
**ISO 27001** requires regular, scheduled backups that are stored securely 
and protected against tampering or accidental deletion. Compliance requires 
storage in a separate environment (e.g., an isolated AWS S3[^25] bucket 
with object lock) so a production server compromise does not also destroy 
the backups. Executions must be logged, failures must trigger alerts, and 
the team must periodically test and document restoring these backups to a 
staging environment.

## Definitions

[^1]: Password-hashing algorithm based on the Blowfish cipher. Unlike a plain
      hash, bcrypt applies a configurable cost factor that makes each
      computation deliberately slow — making brute-forcing a stolen hash 
      database impractical even with modern hardware.

[^2]: A **JWT** (JSON Web Token) issued after login that proves identity on
      each request. Structured as three Base64-encoded segments 
      (`header.payload.signature`) and signed with a secret key — the server
      verifies the signature without a database lookup, keeping auth 
      stateless. Stored only in memory so an XSS attack cannot read it.

[^3]: Environment variable setting the TTL (Time-To-Live) of an access token
      — how long it stays valid before expiring. Set to **15 min** here,
      limiting the damage window if a token is stolen. Short-lived access 
      tokens are paired with longer-lived refresh tokens to avoid forcing 
      re-login every 15 minutes.

[^4]: Open-source in-memory data store used as a database, cache, and message
      broker. Keeps all data in RAM rather than on disk, making reads/writes 
      orders of magnitude faster than a relational database. Used here for 
      refresh-token storage and rate-limit counters.

[^5]: HTTP cookie attribute controlling when cookies are sent with cross-site
      requests. `Lax` sends cookies on top-level navigations (e.g. clicking 
      a link) but blocks them on cross-origin sub-requests (e.g. background
      fetches, iframes). Stricter than `None`, more permissive than `Strict`.
      The browser default in modern browsers.

[^6]: Two distinct attack categories that are often confused because both 
      exploit the relationship between a user, a browser, and a trusted site.
      XSS (Cross-Site Scripting) injects malicious scripts into a trusted 
      page — the victim's browser executes them and can steal tokens or 
      impersonate the user. CSRF (Cross-Site Request Forgery) tricks a 
      logged-in browser into sending a forged request the server accepts as 
      legitimate. XSS exploits the user's trust in the site; CSRF exploits 
      the site's trust in the browser.

[^7]: Symmetric encryption standard combining two components. AES-256 
      (Advanced Encryption Standard, 256-bit key) is the U.S. government 
      approved block cipher — a 256-bit key has 2²⁵⁶ possible combinations,
      infeasible to brute-force with any current or near-future hardware. 
      GCM (Galois/Counter Mode) adds authenticated encryption: it 
      simultaneously encrypts data and produces an authentication tag, so 
      any tampering with the ciphertext is detected on decryption.

[^8]: Node.js logging library built around configurable transports — pluggable
      output destinations such as console, file, or a remote service. Logs 
      can be routed to several transports simultaneously and formatted 
      differently per environment: structured JSON in production for machine 
      parsing, human-readable in development.

[^9]: Cryptographic hash function that takes any input and produces a fixed 
      64-character hex string. A one-way function — the original value cannot
      be recovered from the hash, and any change to the input produces a 
      completely different output. Used here to record that a field changed 
      without storing the value itself in the audit log.

[^10]: **Personally Identifiable Information.** Any data that can directly or
       indirectly identify a natural person. In this project: personnummer 
       (Swedish personal ID number) and bank account numbers. Subject to GDPR
       — must be encrypted at rest, access-controlled, and not retained 
       longer than necessary.

[^11]: Node.js/Express middleware that sets HTTP security response headers 
       automatically. Covers around 15 headers out of the box — each 
       targeting a specific attack class — including CSP, HSTS, 
       X-Frame-Options, and X-Content-Type-Options, without requiring manual 
       per-header configuration.

[^12]: HTTP Strict Transport Security. A response header that tells browsers
       to only connect to the site via HTTPS for a defined duration, even if 
       the user types `http://`. Prevents protocol downgrade attacks where an
       attacker silently strips HTTPS from a connection and reads traffic in 
       plain text.

[^13]: Content Security Policy. A response header declaring which sources the
       browser is permitted to load scripts, styles, fonts, and media from. 
       Even if an attacker injects HTML, the browser refuses to execute 
       scripts from unlisted sources — a second line of defence against XSS.

[^14]: Cross-Origin Resource Sharing. A header mechanism that selectively 
       relaxes the browser's same-origin policy. Without CORS headers, 
       browsers block all cross-origin fetch/XHR requests by default. The 
       server declares which origins, methods, and headers it trusts — here 
       locked to the configured frontend origin only.

[^15]: TypeScript-first schema validation library. Schemas describe the 
       expected shape and types of data; `.parse()` validates input at 
       runtime and returns a typed result or throws a structured error. Used 
       here on every API request body before it reaches the database.

[^16]: Built-in Node.js CLI command that checks installed package versions 
       against the npm advisory database of known vulnerabilities. Reports 
       issues with severity levels (low / moderate / high / critical) and 
       suggests remediation. Should be run regularly and in CI pipelines.

[^17]: GitHub service that monitors repository dependencies and automatically 
       opens pull requests when a package has a published vulnerability or a 
       newer version is available. Configurable per ecosystem (npm, pip, 
       Docker etc.) and per severity threshold.

[^18]: Developer security platform that scans code, open-source dependencies,
       containers, and infrastructure-as-code for known vulnerabilities. 
       Integrates into CI/CD pipelines for automated scanning on every 
       commit, producing prioritized fix guidance.

[^19]: Common Vulnerabilities and Exposures. A public catalogue maintained by
       MITRE where each known security flaw gets a unique identifier (e.g. 
       `CVE-2021-44228`). The standard reference used across security 
       advisories, patch notes, and scanning tools when referring to a 
       specific vulnerability.

[^20]: HTTP status code 429 Too Many Requests — returned when a client 
       exceeds a rate limit. Tells the client to back off, optionally paired 
       with a `Retry-After` header stating how long to wait before retrying.

[^21]: Foreign key constraint behavior that automatically deletes all child 
       records when their parent is deleted. Ensures referential integrity 
       without manual cleanup — deleting a row in `users` cascades through 
       `customers`, `deals`, `messages`, `payments`, and so on.

[^22]: Foreign key constraint behavior that blocks deletion of a parent record
       if any child records still reference it. The delete is rejected until 
       all referencing rows are removed first. The `audit_log` table uses 
       this, preventing hard deletion of any user who has audit entries.

[^23]: GDPR "Right to Erasure" — also called the right to be forgotten. 
       Grants individuals the right to request deletion of their personal 
       data when it is no longer necessary, consent is withdrawn, or 
       processing was unlawful. Controllers must comply without undue delay.

[^24]: GDPR core data processing principles. Personal data must be lawfully 
       collected, used only for the stated purpose, limited to what is 
       necessary (data minimisation), kept accurate, and — critically — not 
       retained longer than necessary (storage limitation). The storage 
       limitation principle is the direct basis for requiring a data 
       retention policy.

[^25]: Amazon Simple Storage Service (S3) is essentially an infinitely 
       scalable hard drive in the cloud, but for files (objects) rather 
       than operating systems or live databases. Instead of standard folders, 
       you put "objects" (like images, JSON blobs, or database dumps) into 
       "buckets." It is heavily used because it is cheap, accessed via simple 
       HTTP APIs, and supports features like "Object Lock" (WORM - Write Once, 
       Read Many). Object Lock means that once a backup is uploaded, it 
       literally cannot be deleted, modified, or encrypted by anyone — even 
       a hacked admin account — until a specific time limit expires.
