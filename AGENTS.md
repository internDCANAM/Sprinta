# AGENTS.md

Rules for all AI coding agents working in this repository.

## Git

- Never stage files, create commits, or push
- When asked to produce a commit message, output it as a pastable block — do not run `git commit`

## Before declaring a task done

1. Run `pnpm lint` from the repo root — report any new errors or warnings introduced by your changes (not pre-existing ones)
2. Run `pnpm -r typecheck` — report any new TypeScript errors
3. Re-read every file you modified

## Scope

- Only modify files directly relevant to the task
- If you spot a pre-existing bug or issue outside scope, note it — do not silently fix it

## Comments and language

- Write all comments in English
- The initial codebase contains Swedish prose comments — do not follow that pattern
- If you edit a file that contains Swedish comments, translate the affected block to English before finishing; never leave a file with mixed comment languages

## User-facing strings

- User-facing strings (API error responses, UI copy) belong in the locale catalog, not hardcoded in source
- Use `t('key')` from `backend/src/lib/locale.ts` for API error responses
- `APP_LOCALE` in `.env` controls the output language (default `sv`)
- Internal errors, thrown errors, and log output are always in English
