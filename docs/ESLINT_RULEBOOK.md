# ESLint Rulebook

Reference for reviewing code.

Each entry explains *why* a rule exists, then where it can be satisfied on paper while its
purpose is quietly defeated. That gap is what a lint run won't show you and a review needs to
catch by reading. Workflow: let the linter catch what it catches, then walk the blind spots
below for anything a diff touches.

## `@typescript-eslint/no-explicit-any`

`any` opts a value out of type checking entirely. Once a value is `any`, every operation on it —
calling it, indexing it, passing it further, returning it — is unchecked, and that unsoundness
spreads to everything that touches it afterward. Banning it forces data shape problems to surface
as an error at the point they're introduced instead of as a runtime crash somewhere downstream.

Includes: `no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-member-access`,
`no-unsafe-return`, `no-unsafe-argument`, `no-unsafe-enum-comparison`, `no-unsafe-unary-minus`,
`no-unsafe-declaration-merging`, `no-unsafe-function-type`.

Blind spots:

- Double-casting through `unknown` (`x as unknown as SomeType`) defeats the whole contract
  without ever writing the word `any`. The type checker treats the value as genuinely typed from
  that point on, so none of the unsafe-* rules have anything left to flag — it's a lie told once,
  not an ongoing unsafe operation. None of the built-in rules catch this by name, but the shape is
  specific enough (a cast to `unknown` immediately re-cast to something else) that a custom
  `no-restricted-syntax` selector can close the gap directly, rather than relying on review alone.
- An untyped parameter that the compiler silently infers as `any` is a strict-mode type-checking
  concern, not something this rule sees — it only fires on `any` written explicitly. A file can
  be lint-clean and still contain implicit `any` if it was never type-checked.
- An unnarrowed unknown value is a legitimate way to avoid `any`, but the rule has no opinion on
  whether that value is ever actually validated before use.

## `@typescript-eslint/no-floating-promises`

An unhandled promise rejection can crash a process or fail silently depending on the runtime.
This rule makes every promise's outcome explicit — awaited, chained with a handler, or
deliberately discarded — so failures can't just evaporate.

Includes: `no-misused-promises`, `require-await`, `await-thenable`, `only-throw-error`,
`prefer-promise-reject-errors`.

Blind spots:

- The rule only looks at bare expression statements, not data flow. A promise assigned to a
  variable or pushed into a collection satisfies it immediately, even if nothing downstream ever
  awaits it or handles a rejection. "Handled somewhere" and "assigned to something" aren't the
  same thing, but the rule can't tell them apart.
- Explicitly discarding a promise is a legitimate, deliberate pattern, but it's indistinguishable
  in a lint pass from someone using the same syntax to make a real error-handling gap go quiet.
- The "don't mark this async unless it needs to be" rule can be satisfied by inserting a
  meaningless await that does nothing, which passes the rule while defeating its intent entirely.
- Throwing or rejecting with a technically-valid error object satisfies these rules even if the
  error carries no useful message or context — they check the type of what's thrown, not the
  usefulness.

## `no-eval` / `no-implied-eval`

Executing a string as code is a direct injection vector — if any part of that string is
influenced by outside input, it's arbitrary code execution. This also anchors a related cluster
of rules about dynamic, hard-to-statically-verify operations: requiring a module by a computed
path, reading a file by a computed path, and shelling out to another process.

Includes: `security/detect-eval-with-expression`, `security/detect-non-literal-require`,
`security/detect-non-literal-fs-filename`, `security/detect-child-process`.

Blind spots:

- The filesystem and require rules fire on *any* dynamic path, sanitized or not — they can't
  distinguish a safely-resolved path from a traversal vulnerability. Because that makes them
  noisy, the common failure mode is suppressing the warning wholesale rather than validating the
  specific path, which erases the one instance where it actually mattered.
- These are commonly configured at a non-blocking severity, meaning a real path-traversal or
  injection-shaped bug can pass a lint run cleanly with no friction at all.
- `eval` and implied-eval only catch the obvious forms of dynamic execution. Equivalent
  mechanisms that run code in a fresh context, or construct a function at runtime through other
  APIs, are a different code path with the same risk and aren't covered by name.
- Flagging the mere presence of process-spawning code, rather than whether its input is
  sanitized, invites the same wholesale-suppression problem as the path rules above.

## `eslint-plugin-security` (remaining rules)

A general-purpose sweep for injection and cryptographic footguns that don't fit neatly elsewhere:
object property access built from a dynamic key, non-constant-time comparisons of secrets, weak
randomness, and regular expressions vulnerable to catastrophic backtracking.

Includes: `detect-object-injection`, `detect-possible-timing-attacks`,
`detect-pseudoRandomBytes`, `detect-unsafe-regex`, `detect-non-literal-regexp`,
`detect-buffer-noassert`, `detect-new-buffer`, `detect-disable-mustache-escape`,
`detect-no-csrf-before-method-override`, `detect-bidi-characters`.

Blind spots:

- Object-injection detection is a static, syntactic check — it cannot tell a safe lookup from an
  attacker-controlled property key, and projects frequently disable it outright because normal,
  safe indexing trips it constantly. If it's off, nothing else fills that gap; a dynamic property
  access built from external input needs a manual look regardless.
- Timing-attack detection works by variable naming, not by tracing where a value actually came
  from. Renaming the variable removes the signal even though the risk is unchanged.
- Weak-randomness detection only sees the call site, not the purpose. It won't know a value is
  being used for something security-sensitive unless that's obvious at the call itself.

## `no-console`

A general no-op-in-production hygiene rule: it flags any console call, regardless of purpose.

Blind spots:

- It has no concept of what a project's actual logging convention is, so it can't verify that a
  log statement goes through the intended logging path, is formatted consistently, or avoids
  putting sensitive data into logs — it only knows whether `console` was called at all.
- It's frequently configured as non-blocking, so debug statements left in from development won't
  stop anything from shipping.

## `eslint-plugin-react` / `eslint-plugin-react-hooks`

React's rules protect two invariants: JSX structure (stable list identity, valid attribute use,
no unsafe lifecycle patterns) and, in the newer hooks rule set, the assumption that components
are pure functions of props and state — no mutating state or props in place, no reading or
writing refs during render, no side effects outside an effect or handler. That second set exists
specifically to make code safe to auto-memoize or compile.

Blind spots:

- Rendering raw HTML from a string is generally allowed by these rule sets as long as it's not
  combined with children on the same element — nothing here checks whether that string is
  actually safe to render. That's a real, unguarded content-injection path unless something else
  in the toolchain checks it, which needs a manual look.
- List-key checks generally only understand array/map literals written directly in JSX; a list
  built up imperatively elsewhere and rendered later can slip past that check.
- Checks aimed at safe external links generally only recognize the literal JSX attribute form —
  opening a URL programmatically through other APIs is a different code path with the same risk,
  uncovered.
- Several of the newer hooks rules (exhaustive dependency checking in particular) are often
  configured as advisory rather than blocking, so an incomplete dependency list is easy to miss
  on a quick pass.

## `@typescript-eslint/restrict-template-expressions`

Stops obviously wrong stringification — interpolating an object or an unformatted value into a
template literal or string concatenation where the result would be meaningless or misleading.

Includes: `restrict-plus-operands`, `no-duplicate-type-constituents`,
`no-redundant-type-constituents`.

Blind spots:

- These rules check that a value is stringifiable, not that its string form is *correct* for the
  context — currency formatting, locale-aware dates, and similar business-level formatting
  concerns all pass cleanly even when wrong. That's a reading task, not a lint-shaped one.

## Evaluating a disable comment

Suppressing a rule isn't inherently wrong — sometimes a pattern is legitimate and the rule
genuinely can't represent it (a language feature that requires an otherwise-discouraged syntax,
or an external contract that requires an otherwise-unused parameter to exist). When a diff adds
one, apply three checks:

1. Is the reason structural — required by a language or framework constraint — rather than just
   more convenient than fixing the underlying issue?
2. Is it scoped to a single line and a single rule, rather than an entire file or every rule at
   once?
3. Would the flagged code actually break something if written the "correct" way instead? If not,
   the disable is hiding a real issue rather than resolving a false one.

## Appendix: full rule reference

| Rule                                                   | Severity | Group                         |
|--------------------------------------------------------|----------|-------------------------------|
| `@typescript-eslint/no-explicit-any`                   | error    | no-explicit-any               |
| `@typescript-eslint/no-unsafe-assignment`              | error    | no-explicit-any               |
| `@typescript-eslint/no-unsafe-call`                    | error    | no-explicit-any               |
| `@typescript-eslint/no-unsafe-member-access`           | error    | no-explicit-any               |
| `@typescript-eslint/no-unsafe-return`                  | error    | no-explicit-any               |
| `@typescript-eslint/no-unsafe-argument`                | error    | no-explicit-any               |
| `@typescript-eslint/no-unsafe-enum-comparison`         | error    | no-explicit-any               |
| `@typescript-eslint/no-unsafe-unary-minus`             | error    | no-explicit-any               |
| `@typescript-eslint/no-unsafe-declaration-merging`     | error    | no-explicit-any               |
| `@typescript-eslint/no-unsafe-function-type`           | error    | no-explicit-any               |
| `no-restricted-syntax` (double-cast through `unknown`) | error    | no-explicit-any               |
| `@typescript-eslint/no-floating-promises`              | error    | no-floating-promises          |
| `@typescript-eslint/no-misused-promises`               | error    | no-floating-promises          |
| `@typescript-eslint/require-await`                     | error    | no-floating-promises          |
| `@typescript-eslint/await-thenable`                    | error    | no-floating-promises          |
| `@typescript-eslint/only-throw-error`                  | error    | no-floating-promises          |
| `@typescript-eslint/prefer-promise-reject-errors`      | error    | no-floating-promises          |
| `no-eval`                                              | error    | no-eval / no-implied-eval     |
| `no-implied-eval` (core + typed variant)               | error    | no-eval / no-implied-eval     |
| `security/detect-eval-with-expression`                 | warn     | no-eval / no-implied-eval     |
| `security/detect-non-literal-require`                  | warn     | no-eval / no-implied-eval     |
| `security/detect-non-literal-fs-filename`              | error    | no-eval / no-implied-eval     |
| `security/detect-child-process`                        | error    | no-eval / no-implied-eval     |
| `security/detect-object-injection`                     | off      | eslint-plugin-security        |
| `security/detect-possible-timing-attacks`              | warn     | eslint-plugin-security        |
| `security/detect-pseudoRandomBytes`                    | warn     | eslint-plugin-security        |
| `security/detect-unsafe-regex`                         | warn     | eslint-plugin-security        |
| `security/detect-non-literal-regexp`                   | warn     | eslint-plugin-security        |
| `security/detect-buffer-noassert`                      | warn     | eslint-plugin-security        |
| `security/detect-new-buffer`                           | warn     | eslint-plugin-security        |
| `security/detect-disable-mustache-escape`              | warn     | eslint-plugin-security        |
| `security/detect-no-csrf-before-method-override`       | warn     | eslint-plugin-security        |
| `security/detect-bidi-characters`                      | warn     | eslint-plugin-security        |
| `no-console`                                           | error    | no-console                    |
| `react/*` (recommended set)                            | error    | react / react-hooks           |
| `react-hooks/rules-of-hooks`                           | error    | react / react-hooks           |
| `react-hooks/static-components`                        | error    | react / react-hooks           |
| `react-hooks/use-memo`                                 | error    | react / react-hooks           |
| `react-hooks/preserve-manual-memoization`              | error    | react / react-hooks           |
| `react-hooks/immutability`                             | error    | react / react-hooks           |
| `react-hooks/purity`                                   | error    | react / react-hooks           |
| `react-hooks/globals`                                  | error    | react / react-hooks           |
| `react-hooks/refs`                                     | error    | react / react-hooks           |
| `react-hooks/set-state-in-render`                      | error    | react / react-hooks           |
| `react-hooks/set-state-in-effect`                      | error    | react / react-hooks           |
| `react-hooks/error-boundaries`                         | error    | react / react-hooks           |
| `react-hooks/config`                                   | error    | react / react-hooks           |
| `react-hooks/gating`                                   | error    | react / react-hooks           |
| `react-hooks/exhaustive-deps`                          | warn     | react / react-hooks           |
| `react-hooks/incompatible-library`                     | warn     | react / react-hooks           |
| `react-hooks/unsupported-syntax`                       | warn     | react / react-hooks           |
| `@typescript-eslint/restrict-template-expressions`     | error    | restrict-template-expressions |
| `@typescript-eslint/restrict-plus-operands`            | error    | restrict-template-expressions |
| `@typescript-eslint/no-duplicate-type-constituents`    | error    | restrict-template-expressions |
| `@typescript-eslint/no-redundant-type-constituents`    | error    | restrict-template-expressions |

### Other

The remaining `typescript-eslint` `recommendedTypeChecked` rules not covered individually above
(`no-unused-vars`, `no-namespace`, `no-require-imports`, `ban-ts-comment`,
`no-non-null-asserted-optional-chain`, `unbound-method`, etc.) are `error` by default. If one of
these fires, check [the rule's own docs](https://typescript-eslint.io/rules/) — the same test
from "Evaluating a disable comment" still applies: is the disable structural or convenience?
