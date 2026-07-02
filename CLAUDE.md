@AGENTS.md

# Sprinta

Customer portal (kundportal) for a Swedish forestry company. Owners track timber deals,
view documents, message admins, and monitor payments.

## Workspace layout

| Package | Path | Role |
|---|---|---|
| `@sprintaiso/backend` | `backend/` | Express API, Prisma ORM, JWT auth, Redis sessions |
| `@sprintaiso/frontend` | `frontend/` | Vite + React 18, Tailwind CSS, TanStack Query |
| `@sprintaiso/shared` | `shared/` | Cross-package types and enums |

## Key commands

| Task | Command |
|---|---|
| Lint all packages | `pnpm lint` |
| Fix auto-fixable lint | `pnpm lint:fix` |
| Type-check all packages | `pnpm -r typecheck` |
| Start backend (dev) | `pnpm backend dev` |
| Start frontend (dev) | `pnpm --filter @sprintaiso/frontend dev` |
| Prisma studio | `pnpm backend prisma:studio` |
| Seed database | `pnpm backend db:seed` |
| DB up (postgres + redis) | `pnpm db:up` |
| DB reset | `pnpm db:reset` |

## Shared package

Cross-package types and enums live in `shared/src/`, imported as `@sprintaiso/shared`.

- `types.ts` — DTOs and API response shapes as `interface`s; these are the authoritative shapes for all API boundaries

## Auth architecture

- Access tokens: short-lived JWT, sent as `Authorization: Bearer …`
- Refresh tokens: stored in Redis, delivered as an `HttpOnly` cookie
- Session invalidation: deleting the Redis key ends the session — the basis for "logout from all devices"
- Auth middleware: `backend/src/middleware/auth.ts`

## User-facing strings

API error responses use `t('key')` from `backend/src/lib/locale.ts`.
`APP_LOCALE` in `.env` sets the output language (default `sv` — Swedish for end customers).
Do not hardcode Swedish or English strings in route handlers or components.
Internal errors, thrown errors, and all log output are always in English.
