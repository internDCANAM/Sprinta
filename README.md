# Sprintaiso Kundportal

Customer portal for a Swedish forestry company. Owners can track timber deals, view
documents, message admins, and monitor payments.

**Stack:** pnpm monorepo — Express + Prisma + PostgreSQL + Redis (backend), Vite + React 18 + Tailwind (frontend), shared TypeScript types.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (PostgreSQL + Redis)

## Setup

### 1. Configure environment

`.env.example` files exist in `backend/` and `frontend/`. Copy each to `.env`:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Generate the required `ENCRYPTION_KEY` (used to encrypt PII at rest):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `backend/.env` as `ENCRYPTION_KEY=<value>`.

### 2. Start the database

```bash
pnpm db:up
```

Starts PostgreSQL and Redis via Docker Compose. Verify with `docker compose ps`.

### 3. Install dependencies

```bash
pnpm install
```

### 4. Initialize the database

```bash
pnpm backend prisma:generate   # generate Prisma client from schema
pnpm backend prisma:migrate    # create tables and indexes
pnpm backend db:seed           # populate with test data
```

## Running locally

Start each server from the repo root:

```bash
pnpm backend dev                               # API — localhost:3000
pnpm --filter @sprintaiso/frontend dev         # portal — localhost:5173
```

Visit `http://localhost:5173`.

## Test credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@skogsbo.se` | `Admin123!` |
| Customer | `klas@example.se` | `Skog123!` |

## Project structure

```
.
├── backend/        Express API, Prisma ORM, JWT auth, Redis sessions
│   ├── src/
│   │   ├── routes/     auth, deals, documents, payments, messages
│   │   ├── middleware/ auth, error handling, rate limiting
│   │   └── lib/        crypto (PII), JWT, locale (i18n), validation
│   └── prisma/     schema and migrations
├── frontend/       Vite + React customer portal
│   └── src/
│       ├── pages/      page components
│       ├── components/ reusable UI
│       └── api/        API client (axios + TanStack Query)
└── shared/         cross-package TypeScript types and enums
```

## Development

### Lint and type-check

```bash
pnpm lint          # ESLint across all packages
pnpm lint:fix      # auto-fix where possible
pnpm typecheck     # tsc --noEmit across all packages
```

Run both before opening a PR. The CI pipeline enforces this.

## Working in this repo

### todo.md

`todo.md` is a **pre-issue scratch pad** — not a task tracker. It holds two things:

- **Pending decisions** — things the team needs to agree on before work can start (e.g. config choices, retention policies). Once decided, the item is checked off and any resulting work becomes a GitHub Issue.
- **Rough ideas** — features or changes too vague to scope yet. Flesh them out here, then promote to a GitHub Issue when ready.

Concrete tasks (bugs, features with clear scope) live in **GitHub Issues**, not here.

### Agent instruction files

Three files tell AI coding assistants how to behave in this repo. They are layered — each one builds on `AGENTS.md`:

| File | Read by | Purpose |
|---|---|---|
| `AGENTS.md` | all agents (source of truth) | universal behavioral rules: git constraints, pre-task checklist, language policy, scope rules |
| `CLAUDE.md` | Claude Code (auto) | imports `AGENTS.md` via `@AGENTS.md`, then adds stack overview, key commands, and architecture notes |
| `.github/copilot-instructions.md` | GitHub Copilot (auto) | standalone summary of `AGENTS.md` (Copilot does not support file imports) |

**Key rules every agent follows (defined in `AGENTS.md`):**

- Never stage, commit, or push — commit messages are output as pastable blocks only
- Run `pnpm lint` and `pnpm typecheck` before finishing any task; report new errors
- Re-read every modified file before responding
- Write all comments in English; translate any Swedish comments encountered in edited files
- Domain enum values (`PAGAENDE`, `SLUTAVVERKNING`, etc.) are Swedish by design — do not translate them
- User-facing strings go through `t()` in `backend/src/lib/locale.ts`; internal errors stay in English
