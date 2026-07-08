@AGENTS.md

# Sprinta

Customer portal (kundportal) for a Swedish forestry company. Owners track timber
deals, view documents, message admins, and monitor payments.

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
