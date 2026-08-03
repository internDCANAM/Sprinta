# Sprinta

A portal for Swedish forestry landowners to track timber deals, view documents,
message admins, and monitor payments. Built with ISO/IEC 27001
information-security alignment in mind: encrypted-at-rest sensitive fields,
hashed audit trails, rate-limited auth endpoints with security-event logging,
and DB-checked (not token-cached) admin access.

**Stack:** Express + Prisma + PostgreSQL + Redis + Vite + React 18 + Tailwind.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (PostgreSQL + Redis)

Verify pnpm is available before starting:

```bash
pnpm --version  # else run: npm install -g pnpm
```

## Setup

Copy the env files (Windows: `Copy-Item` instead of `cp`), generate
`ENCRYPTION_KEY`, and set it in `backend/.env`:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then:

```bash
pnpm install
pnpm db:up                    # postgres + redis via Docker Compose
pnpm backend prisma:generate  # generate the Prisma client from schema.prisma
pnpm backend prisma:push      # sync the schema — no migrations to run
```

Run `pnpm backend test` or the tests from testui to create a real account ready
to use against the running app.

## Running locally

```bash
pnpm backend dev                          # API — localhost:4000
pnpm --filter @sprintaiso/frontend dev    # portal — localhost:5173
```

Visit `http://localhost:5173`

### Running a production-style build

```bash
pnpm backend build && pnpm backend start   # API from dist/, no watch/reload
pnpm --filter @sprintaiso/frontend build   # portal, output in frontend/dist/
```

## Development

### ESLint

ESLint enforces correctness and security rules across all packages.

`eslint-plugin-security` is included for ISO/IEC 27001 A.8.28 (Secure Coding)
alignment. It detects Node.js-specific vulnerabilities in your own code —
things Dependabot cannot catch because Dependabot only scans dependencies, not
what you write.

#### Rules & Why

- `@typescript-eslint/no-explicit-any` — bans the `any` type. TypeScript's
  safety guarantees only hold when everything is typed; `any` silently opts out
  of that.
- `no-eval` — bans `eval()`, which executes arbitrary strings as code and is a
  direct injection vector.
- `no-implied-eval` — same risk, less obvious: catches `setTimeout("code")` and
  `new Function("code")`.
- `no-console` — errors when `console` is used instead of the Winston logger.
  Raw console calls bypass log levels, timestamps, and structured JSON output in
  production.
- `security/detect-unsafe-regex` — catches regexes vulnerable to ReDoS
  (exponential backtracking on crafted input).
- `security/detect-non-literal-fs-filename` — flags `fs.readFile(userInput)`,
  which can expose arbitrary files.
- `security/detect-non-literal-require` — flags `require(variable)`, which can
  load arbitrary modules.

This is a short, illustrative subset. For the full configured rule set, and for
the blind spots a green lint run won't show you, see
[`docs/ESLINT_RULEBOOK.md`](docs/ESLINT_RULEBOOK.md).

#### Commands

```bash
pnpm lint         # ESLint across all packages
pnpm lint:fix     # auto-fix where possible
pnpm typecheck    # tsc --noEmit across all packages
```

### Comments & TSDoc

When to write a comment at all, when a plain `//` is enough versus a full TSDoc
block, how to reference a non-obvious library call without a rotting web link,
and what actually renders in an editor's hover popup (and what doesn't) — see
[`docs/COMMENT_STYLE.md`](docs/COMMENT_STYLE.md).

## Working in this repo

### todo.md

`todo.md` is a **pre-issue scratch pad** — not a task tracker. It holds two
things:

- **Pending decisions** — things the team needs to agree on before work can
  start (e.g. config choices, retention policies). Once decided, the item is
  checked off and any resulting work becomes a GitHub Issue.
- **Rough ideas** — features or changes that need discussion or feedback before
  they can be scoped. Once the direction is clear, promote to a GitHub Issue.

**GitHub Issues** are for anything concrete enough to actually work on — bugs,
features, UI work. If you want to start on the frontend login layout, open an
Issue with a `Type: feature` label and a one-line description of what you're
building. You don't need a full spec; just enough that someone else could pick
it up.

The distinction: if you need the team to weigh in before you start, put it in
`todo.md` first. If you already know what you're doing, go straight to an Issue.

### Agent instruction files

Three files tell AI coding assistants how to behave in this repo. They are
layered — each one builds on `AGENTS.md`:

| File                              | Read by                      | Purpose                                                                                              |
|-----------------------------------|------------------------------|------------------------------------------------------------------------------------------------------|
| `AGENTS.md`                       | all agents (source of truth) | universal behavioral rules: git constraints, pre-task checklist, language policy, scope rules        |
| `CLAUDE.md`                       | Claude Code (auto)           | imports `AGENTS.md` via `@AGENTS.md`, then adds stack overview, key commands, and architecture notes |
| `.github/copilot-instructions.md` | GitHub Copilot (auto)        | standalone summary of `AGENTS.md` (Copilot does not support file imports)                            |

**Key rules every agent follows (defined in `AGENTS.md`):**

- Never stage, commit, or push — commit messages are output as pastable blocks
  only
- Run `pnpm lint` and `pnpm typecheck` before finishing any task; report new
  errors
- Re-read every modified file before responding
- Write all comments in English; translate any Swedish comments encountered in
  edited files
- Comment style (when to use TSDoc, how to reference library calls, hover
  rendering) follows `docs/COMMENT_STYLE.md`
