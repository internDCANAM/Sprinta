# Sprinta

A portal for Swedish forestry landowners to track timber deals, view documents,
message admins, and monitor payments. Built with ISO/IEC 27001
information-security alignment in mind: encrypted-at-rest sensitive fields,
hashed audit trails, rate-limited auth endpoints with security-event logging,
and DB-checked (not token-cached) admin access.

## Setup

**Stack:**    Express, Prisma, PostgreSQL, Redis, Vite, React 19, Tailwind  
**Requires:** Node 20+, pnpm 9+, Docker

Unix:

```bash
cp .env.example .env && cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env
```

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Then, either:

```bash
pnpm env:secrets              # writes JWT / CSRF / ENCRYPTION_KEY into backend/.env
pnpm install                  # install packages
pnpm db:up                    # postgres + redis
pnpm backend prisma:generate  # (re)create required generated/ dir
pnpm backend prisma:push      # schema sync, no migrations
```

## Run

```bash
pnpm backend dev              # API —    http://localhost:4000
pnpm frontend dev             # portal — http://localhost:5173
```

No register UI. Create the first user against the API:

```bash
curl -s localhost:4000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"changeme1","name":"You"}'
```

Windows: use `curl.exe` (plain `curl` in PowerShell is a different command).

```powershell
curl.exe -s localhost:4000/api/v1/auth/register -H "content-type: application/json" -d "{\"email\":\"you@example.com\",\"password\":\"changeme1\",\"name\":\"You\"}"
```

Then log in at `/login`.

## Commands

```bash
pnpm lint / pnpm lint:fix     # ESLint
pnpm typecheck                # tsc --noEmit
pnpm backend test             # Vitest
pnpm backend prisma:studio    # DB browser
pnpm db:down / pnpm db:reset  # stop / wipe volumes
```

More: [ESLint rulebook](docs/ESLINT_RULEBOOK.md), [agent rules](AGENTS.md),
[comments in code](docs/COMMENT_STYLE.md)
