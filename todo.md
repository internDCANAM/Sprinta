# todo

Concrete tasks live in GitHub Issues. This file is for decisions that need team alignment
before work can start, and rough ideas not yet ready to be scoped.

## Pending decisions

- [ ] **Prettier config** — agree on print width (80 or 100), quotes (single),
      semicolons. Install `prettier` + `husky` + `lint-staged` once decided.
- [x] **AGENTS.md** — agree on agent rules before committing the file.
- [x] **Dependabot, Snyk, or both** — Dependabot is free and catches outdated deps;
      Snyk adds vuln scanning. They complement each other but Dependabot alone is
      a reasonable starting point.
- [ ] **Audit log retention** — decide how long messages and deals are kept in db logs
      before the schema and cleanup jobs can be written.

## Rough ideas

Too vague for an issue — flesh out before promoting.

- **Land cadastral overlay** — map overlay of owner cadastrals using MapLibre GL JS.
  Owners input their cadastral IDs; polygons fetched from public registry. If GeoJSON
  performance is a problem, convert to vector tiles (MVT) with tippecanoe or PostGIS
  `ST_AsMVT`. National agencies expose WMS links for soil, terrain, and elevation that
  can be layered directly as raster tile sources.
- **'Logout from all devices'** — needs both an API endpoint (invalidate all sessions
  in Redis) and a frontend trigger. Straightforward but touches auth middleware.
