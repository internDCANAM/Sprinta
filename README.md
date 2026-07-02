# Sprintaiso Kundportal

Customer portal for a Swedish forestry company. Owners can track timber deals, view
documents, message admins, and monitor payments.

**Stack:** pnpm monorepo — Express + Prisma + PostgreSQL + Redis (backend), Vite + React 18 + Tailwind (frontend), shared TypeScript types.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (PostgreSQL + Redis)

Verify pnpm is available before starting:

```bash
pnpm --version   # should print 9.x.x — if not found: npm install -g pnpm
```

## Setup

> **Windows:** the `cp` commands in setup below are Unix/Mac only. Use `copy` in CMD or `Copy-Item` in PowerShell, or just duplicate the files manually.

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
pnpm backend prisma:generate    # generate Prisma client from schema
pnpm backend prisma:migrate     # create tables and indexes
pnpm backend db:seed            # populate with test data
```

## Running locally

Start each server from the repo root:

```bash
pnpm backend dev                          # API — localhost:3000
pnpm --filter @sprintaiso/frontend dev    # portal — localhost:5173
```

Visit `http://localhost:5173`.

## Test credentials

| Role     | Email              | Password    |
|----------|--------------------|-------------|
| Admin    | `admin@skogsbo.se` | `Admin123!` |
| Customer | `klas@example.se`  | `Skog123!`  |

## Project structure

```
.
├── backend/            Express API, Prisma ORM, JWT auth, Redis sessions
│   ├── src     
│   │   ├── routes/     auth, deals, documents, payments, messages
│   │   ├── middleware/ auth, error handling, rate limiting
│   │   └── lib/        crypto (PII), JWT, locale (i18n), validation
│   └── prisma/         schema and migrations
├── frontend/           Vite + React customer portal
│   └── src     
│       ├── pages/      page components
│       ├── components/ reusable UI
│       └── api/        API client (axios + TanStack Query)
└── shared/             cross-package TypeScript types and enums
```

## Development

### ESLint

ESLint enforces correctness and security rules across all packages.

`eslint-plugin-security` is included for ISO 27001 A.8.28 (Secure Coding) compliance. It detects Node.js-specific vulnerabilities in your own code — things Dependabot cannot catch because Dependabot only scans dependencies, not what you write.

#### Rules

- `@typescript-eslint/no-explicit-any` — bans the `any` type. TypeScript's safety guarantees only hold when everything is typed; `any` silently opts out of that.
- `no-eval` — bans `eval()`, which executes arbitrary strings as code and is a direct injection vector.
- `no-implied-eval` — same risk, less obvious: catches `setTimeout("code")` and `new Function("code")`.
- `no-console` — warns when `console` is used instead of the Winston logger. Raw console calls bypass log levels, timestamps, and structured JSON output in production.
- `security/detect-unsafe-regex` — catches regexes vulnerable to ReDoS (exponential backtracking on crafted input).
- `security/detect-non-literal-fs-filename` — flags `fs.readFile(userInput)`, which can expose arbitrary files.
- `security/detect-non-literal-require` — flags `require(variable)`, which can load arbitrary modules.

#### Commands

```bash
pnpm lint         # ESLint across all packages
pnpm lint:fix     # auto-fix where possible
pnpm typecheck    # tsc --noEmit across all packages
```

### Prettier

Prettier formats code automatically on save — indentation, quotes, semicolons, line breaks.

Config lives in `.prettierrc` at the repo root. All editors read the same file, so formatting is consistent regardless of who commits.

**VS Code:** install the [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) (`esbenp.prettier-vscode`).

**IntelliJ / WebStorm:** Settings → Languages & Frameworks → JavaScript → Prettier → set the Prettier package path to `<project>/node_modules/prettier` and enable "Run on save".

## Working in this repo

### todo.md

`todo.md` is a **pre-issue scratch pad** — not a task tracker. It holds two things:

- **Pending decisions** — things the team needs to agree on before work can start (e.g. config choices, retention policies). Once decided, the item is checked off and any resulting work becomes a GitHub Issue.
- **Rough ideas** — features or changes that need discussion or feedback before they can be scoped. Once the direction is clear, promote to a GitHub Issue.

**GitHub Issues** are for anything concrete enough to actually work on — bugs, features, UI work. If you want to start on the frontend login layout, open an Issue with a `Type: feature` label and a one-line description of what you're building. You don't need a full spec; just enough that someone else could pick it up.

The distinction: if you need the team to weigh in before you start, put it in `todo.md` first. If you already know what you're doing, go straight to an Issue.

### Agent instruction files

Three files tell AI coding assistants how to behave in this repo. They are layered — each one builds on `AGENTS.md`:

| File                              | Read by                      | Purpose                                                                                              |
|-----------------------------------|------------------------------|------------------------------------------------------------------------------------------------------|
| `AGENTS.md`                       | all agents (source of truth) | universal behavioral rules: git constraints, pre-task checklist, language policy, scope rules        |
| `CLAUDE.md`                       | Claude Code (auto)           | imports `AGENTS.md` via `@AGENTS.md`, then adds stack overview, key commands, and architecture notes |
| `.github/copilot-instructions.md` | GitHub Copilot (auto)        | standalone summary of `AGENTS.md` (Copilot does not support file imports)                            |

**Key rules every agent follows (defined in `AGENTS.md`):**

- Never stage, commit, or push — commit messages are output as pastable blocks only
- Run `pnpm lint` and `pnpm typecheck` before finishing any task; report new errors
- Re-read every modified file before responding
- Write all comments in English; translate any Swedish comments encountered in edited files
- Domain enum values (`PAGAENDE`, `SLUTAVVERKNING`, etc.) are Swedish by design — do not translate them
- User-facing strings go through `t()` in `backend/src/lib/locale.ts`; internal errors stay in English
