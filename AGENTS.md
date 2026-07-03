# AGENTS.md

Rules for all AI coding agents working in this repository.

## Git

- Never stage files, create commits, or push
- When asked to produce a commit message, output it as a pastable block — do not run `git commit`

## Before declaring a task done

1. Run `pnpm lint` from the repo root — new errors or warnings introduced by your changes must be fixed before finishing, not just reported (pre-existing ones can be noted and left alone, per Scope below)
2. Run `pnpm -r typecheck` — same: new TypeScript errors introduced by your changes must be fixed, not just reported
3. Re-read every file you modified

## Code review

When asked to review code rather than write it, also check `docs/ESLINT_RULEBOOK.md`. It documents patterns that satisfy a configured rule's letter while defeating its purpose — the kind of thing a lint run won't surface on its own. Not needed for routine authoring; lint/typecheck passing (above) already covers what ESLint can see.

## Scope

- Only modify files directly relevant to the task
- If you spot a pre-existing bug or issue outside scope, note it — do not silently fix it

## Comments and language

- Write all comments in English
- The initial codebase contains Swedish prose comments — do not follow that pattern
- If you edit a file that contains Swedish comments, translate the affected block to English before finishing; never leave a file with mixed comment languages
- When writing or editing a comment (trailing `//` or a TSDoc block), follow `docs/COMMENT_STYLE.md`

## User-facing strings

- User-facing strings (API error responses, UI copy) belong in the locale catalog, not hardcoded in source
- Use `t('key')` from `backend/src/lib/locale.ts` for API error responses
- `APP_LOCALE` in `.env` controls the output language (default `sv`)
- Internal errors, thrown errors, and log output are always in English
