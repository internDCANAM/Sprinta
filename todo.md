# todo

GitHub Issues are for anything concrete enough to work on — bugs, features, UI work.
This file is for decisions that need team alignment before work can start, and ideas
that need feedback before they're ready to be scoped as an Issue.

## Pending decisions

- [x] **Prettier config** — agree on print width (80 or 100), quotes (single),
      semicolons.
- [x] **AGENTS.md** — agree on agent rules before committing the file.
- [x] **Dependabot, Snyk, or both** — Dependabot is free and catches outdated deps;
      Snyk adds vuln scanning. They complement each other but Dependabot alone is
      a reasonable starting point.
- [x] **eslint-plugin-security** — scans for Node.js vulnerabilities.
- [x] **eslint configurations** — relevant to ISO rules.
- [ ] **Audit log retention** — decide how long messages and deals are kept in db logs
      before the schema and cleanup jobs can be written.
- [ ] `REFRESH_TTL_SECONDS` / `JWT_REFRESH_TTL` synchronisation — either parse the TTL
      string with ms to drive the Redis TTL, or lock the two to the same value in the
      schema.
- [ ] **Auth route error strings** — wire up t() from locale.ts in auth.ts (and verify 
      all other routes do the same before launch).
- [ ] **Introduce locale-based codebase** — migrate Swedish domain enum values
      (`PAGAENDE`, `SLUTAVVERKNING`, `AVVERKNING_START`, etc.) to English identifiers
      throughout source, shared types, and database schema. Requires coordinated
      migration: Prisma schema rename + data migration + shared enums + all call sites.
- [ ] **Writing tests** — ...

## Rough ideas

Too vague for an issue — flesh out before promoting.

- **Land cadastral overlay** — map overlay of owner cadastrals using MapLibre GL JS.
  Owners input their cadastral IDs; polygons fetched from public registry. If GeoJSON
  performance is a problem, convert to vector tiles (MVT) with tippecanoe or PostGIS
  `ST_AsMVT`. National agencies expose WMS links for soil, terrain, and elevation that
  can be layered directly as raster tile sources.
- **'Logout from all devices'** — needs both an API endpoint (invalidate all sessions
  in Redis) and a frontend trigger. Straightforward but touches auth middleware.
