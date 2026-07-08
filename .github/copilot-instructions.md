# Copilot instructions

## Git

- Never create commits or push
- When asked to produce a commit message, output it as a pastable block — do not
  run `git commit`

## Before declaring a task done

**DONE CRITERIA**: Fix all newly introduced errors before completing. Run `pnpm lint`
and `pnpm -r typecheck` from repo root. Self-review all modified files. Ignore
pre-existing/out-of-scope errors.

## Code review

When asked to review code rather than write it, also check
`docs/ESLINT_RULEBOOK.md`. It documents patterns that satisfy a configured
rule's letter while defeating its purpose — the kind of thing a lint run won't
surface on its own. Not needed for routine authoring; lint/typecheck passing
(above) already covers what ESLint can see.

## Scope

- Only modify files directly relevant to the task
- If you spot a pre-existing bug or issue outside scope, note it — do not
  silently fix it

## Comments and language

- Follow `docs/COMMENT_STYLE.md` only when authoring new TSDoc blocks or
  performing documentation tasks. Ignore pre-existing inline comments.
