# Copilot instructions

See `AGENTS.md` at the repo root for the full rule set. Summary of the most important points:

## Git

Never stage files, commit, or push. If asked for a commit message, output it as a
pastable block only — do not run `git commit`.

## Before finishing any task

1. Run `pnpm lint` from the repo root; report new errors introduced by your changes
2. Run `pnpm -r typecheck`; report any new TypeScript errors
3. Re-read every file you modified

## Comments and language

Write all comments in English. If a file you edit contains Swedish comments, translate
the affected block before finishing — never leave a file with mixed comment languages.

Domain enum values (`SLUTAVVERKNING`, `PAGAENDE`, `AVVERKNING_START`, etc.) are Swedish
by design and match the database schema. Do not translate or rename them.

## User-facing strings

Use `t('key')` from `backend/src/lib/locale.ts` for API error responses.
Do not hardcode Swedish or English strings in route handlers or components.
Internal errors and log output are always in English.

## Scope

Only touch files relevant to the task. Note pre-existing issues rather than silently fixing them.
