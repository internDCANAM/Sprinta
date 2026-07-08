# todo

GitHub Issues are for anything concrete enough to work on — bugs, features, UI
work. This file is for decisions that need team alignment before work can start,
and ideas that need feedback before they're ready to be scoped as an Issue.

## Pending decisions
- [x] **Test Architecture** — location/coverage/extensions/libraries  
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

- **Land cadastral overlay** — map overlay of owner cadastrals using MapLibre GL
  JS. Owners input their cadastral IDs; polygons fetched from public registry.
  If GeoJSON performance is a problem, convert to vector tiles (MVT) with
  tippecanoe or PostGIS `ST_AsMVT`. National agencies expose WMS links for soil,
  terrain, and elevation that can be layered directly as raster tile sources.
