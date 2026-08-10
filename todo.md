# todo

GitHub Issues are for anything concrete enough to work on — bugs, features, UI
work. This file is for decisions that need team alignment before work can start,
and ideas that need feedback before they're ready to be scoped as an Issue.


## Pending decisions
- [ ] **Rewrite** [ISO_IEC_27001.md](docs/ISO_IEC_27001.md)

## Rough ideas

Too vague for an issue — flesh out before promoting.

- **Land cadastral overlay** — map overlay of owner cadastrals using MapLibre GL
  JS. Owners input their cadastral IDs; polygons fetched from public registry.
  If GeoJSON performance is a problem, convert to vector tiles (MVT) with
  tippecanoe or PostGIS `ST_AsMVT`. National agencies expose WMS links for soil,
  terrain, and elevation that can be layered directly as raster tile sources.
