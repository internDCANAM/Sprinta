# Copilot instructions

See `AGENTS.md` at the repo root for the full rule set. Summary of the most important points:

## Git

Never stage files, commit, or push. If asked for a commit message, output it as a
pastable block only — do not run `git commit`.

## Before finishing any task

1. Run `pnpm lint` from the repo root; new errors or warnings introduced by your changes must be
   fixed before finishing, not just reported (pre-existing ones can be noted and left alone)
2. Run `pnpm -r typecheck`; same — fix any new TypeScript errors your changes introduce
3. Re-read every file you modified

## Code review

When asked to review code rather than write it, also check `docs/ESLINT_RULEBOOK.md` — it covers
patterns that satisfy a lint rule's letter while defeating its purpose. Not needed for routine
authoring.

## Scope

Only touch files relevant to the task. Note pre-existing issues rather than silently fixing them.

## Comments and language

Write all comments in English. If a file you edit contains Swedish comments, translate
the affected block before finishing — never leave a file with mixed comment languages.
When writing or editing a comment, follow `docs/COMMENT_STYLE.md`.

## User-facing strings

Use `t('key')` from `backend/src/lib/locale.ts` for API error responses.
`APP_LOCALE` in `.env` controls the output language (default `sv`).
Do not hardcode Swedish or English strings in route handlers or components.
Internal errors and log output are always in English.
