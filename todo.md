# todo

GitHub Issues are for anything concrete enough to work on — bugs, features, UI
work. This file is for decisions that need team alignment before work can start,
and ideas that need feedback before they're ready to be scoped as an Issue.


## Pending decisions
- [ ] **Rewrite** [ISO_IEC_27001.md](docs/ISO_IEC_27001.md)
- [x] **Test Architecture** — location/coverage/extensions/libraries  
  Tests live in `backend/tests/`, hit the real HTTP server, no separate test
  database — see `tests/admin.test.ts` and `tests/user.test.ts` for the pattern.  
  **Mandatory:**
  - [ ] config/env.ts: loadEnv()
  - [ ] lib/crypto.ts: maskBankAccount/hashForAudit
  - [ ] utils/auth.ts (sign/verify roundtrip covered indirectly via login, still
        need a tampered/expired-token case)
  - [x] middleware/auth.ts (`adminMiddleware`) — `tests/admin.test.ts`
  - [ ] middleware/ownership.ts (a second user denied another's deal)
  - [ ] middleware/validate.ts — **not wired into any route** right now
  - [x] middleware/rateLimit.ts — `tests/admin.test.ts`
  - [ ] utils/http.ts: `errorHandler` — no message/stack leakage on unhandled
        errors (file was `middleware/error.ts`, folded into `utils/http.ts`)
  - [ ] app.ts: helmet/cors headers actually present on responses

## Rough ideas

Too vague for an issue — flesh out before promoting.

- **Land cadastral overlay** — map overlay of owner cadastrals using MapLibre GL
  JS. Owners input their cadastral IDs; polygons fetched from public registry.
  If GeoJSON performance is a problem, convert to vector tiles (MVT) with
  tippecanoe or PostGIS `ST_AsMVT`. National agencies expose WMS links for soil,
  terrain, and elevation that can be layered directly as raster tile sources.
