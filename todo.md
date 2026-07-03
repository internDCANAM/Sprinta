# todo

GitHub Issues are for anything concrete enough to work on — bugs, features, UI work.
This file is for decisions that need team alignment before work can start, and ideas
that need feedback before they're ready to be scoped as an Issue.

## Pending decisions

- [ ] **Audit log retention** — decide how long messages and deals are kept in db logs
      before the schema and cleanup jobs can be written.
- [ ] **Locale/error-string catalog** — `backend/src/lib/locale.ts` doesn't exist yet, 
      and no route calls `t()`. Error strings are hardcoded and inconsistently mixed: 
      English in `auth.ts`, Swedish in `me.ts` and `admin.ts`. Before this is issue-sized, 
      decide the catalog shape (flat vs. nested keys, whether messages take interpolated 
      params) and where the sv/en string pairs live. Once decided, the issue covers all routes
       — `auth.ts`, `me.ts`, `admin.ts`, `deals.ts`, `payments.ts` — not just auth.ts.
- [ ] **Introduce locale-based codebase** — migrate Swedish domain enum values
      (`PAGAENDE`, `SLUTAVVERKNING`, `AVVERKNING_START`, etc.) to English identifiers
      throughout source, shared types, and database schema. Requires coordinated
      migration: Prisma schema rename + data migration + shared enums + all call sites.
      Decided, but sequence after (or alongside) the locale/error-string catalog above:
      `admin.ts` carries both the Swedish enum values and hardcoded Swedish error strings,
      and `StatusBadge.tsx` already hardcodes its own Swedish label map keyed by these enum
      values — renaming first risks touching both files twice once the real locale
      mechanism lands.
- [ ] **Test Architecture** — location/coverage/extensions/libraries  
  **Mandatory:**
  - config/env.ts: loadEnv()
  - lib/crypto.ts: encrypt/decrypt/maskBankAccount/hashForAudit
  - utils/auth.ts
  - middleware/auth.ts: role middleware
  - middleware/ownership.ts
  - middleware/validate.ts
  - middleware/rateLimit.ts
  - middleware/error.ts: no message/stack leakage on unhandled errors
  - app.ts: helmet/cors headers actually present on responses

## Rough ideas

Too vague for an issue — flesh out before promoting.

- **Land cadastral overlay** — map overlay of owner cadastrals using MapLibre GL JS.
  Owners input their cadastral IDs; polygons fetched from public registry. If GeoJSON
  performance is a problem, convert to vector tiles (MVT) with tippecanoe or PostGIS
  `ST_AsMVT`. National agencies expose WMS links for soil, terrain, and elevation that
  can be layered directly as raster tile sources.
