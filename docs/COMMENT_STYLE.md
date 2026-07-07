# Comment & TSDoc Style Guide

Guidelines for comments in this codebase, and for using TSDoc.

## Default: no comment

Well-named identifiers already say what code does. Write a comment when it carries
information the code cannot: a hidden constraint, a subtle invariant, a workaround for a
specific bug, or a reason a non-obvious choice was made. Applies to both trailing `//`
comments and TSDoc blocks.

## When to use TSDoc vs. a trailing comment

Use a full `/** */` TSDoc block instead of a trailing `//` when any of these apply:

- The symbol is **exported** — another file can import and hover it.
- The explanation is long enough, or the file large enough, that a trailing comment would
  wrap awkwardly or crowd the line it's attached to.
- The comment needs **`{@link}`** to resolve. `{@link}` only resolves inside a real doc
  comment attached to a declaration — writing `// {@link x}` as a line comment does not
  produce a link, it's just literal text.

Otherwise — a short, one-phrase clarification on non-exported code — a trailing `//` is enough.

## Structure of a TSDoc block

- **Summary** (first paragraph) — one or two sentences; most editors surface this first in
  the hover popup, with the rest visible on scroll.
- **`@param name`** / **`@returns`** — describe meaning, not type. The compiler already
  carries the type, so repeating it in prose is a second copy that can drift out of sync.
- **`@throws`** — only when the failure mode isn't obvious from the name or signature.
- **`@see {@link symbolName}`** / inline **`{@link symbolName}`** — see "Referencing
  non-standard-library usage" below.

**What hover actually supports:** hover popups are LSP `MarkupContent`, which the spec limits
to GitHub-Flavored Markdown and explicitly permits clients to strip HTML — assume only
bold/italic, inline code, fenced code, lists, and links render; never raw `<tags>`. On `.ts`
files specifically, the popup is produced by `tsserver`, not a full TSDoc renderer, so only
classic JSDoc tags get special layout: `@param`, `@returns`, `@throws`, `@see`, `{@link}`,
`@deprecated` (struck through), `@template`. TSDoc-only tags — `@remarks`, `@typeParam`,
`@example`, `@privateRemarks` — are parsed but shown as plain text, no special section. `@inheritDoc`
does nothing at all in the editor; write the comment out rather than relying on it.

## Referencing non-standard-library usage

When a comment leans on a non-obvious library function — one whose behavior isn't apparent
from its name alone — reference it with `{@link symbolName}` rather than a web link. As long
as the symbol is already in scope (imported), TSDoc resolves the reference against symbols
visible at that point in the file, the same resolution TypeScript's own language service uses
for IntelliSense. That gets a hover/go-to-definition link straight to wherever the symbol is
actually declared — the library's own `.d.ts`, or another file in this repo — instead of a URL
that can drift out of date, point at the wrong version, or break outright.

`{@link name}` only resolves for a bare identifier already in scope at that point in the file
(an imported binding, a local declaration). It cannot resolve a dotted path like
`{@link Foo.bar}` reliably, and it cannot resolve something that isn't imported — there's
nothing in scope for it to bind to.

## Trailing comments on adjacent lines

Keep trailing `//` comments in a block of adjacent declarations short — long ones push the
aligned column far past normal line width; if one needs more room, give it a block comment
above the declaration instead. Once one line in the group has a trailing comment, give every
line in that group one, even if it states something fairly obvious — a gap in an otherwise
aligned block reads as a missing explanation, not as "this one didn't need it."

## Example

```ts
const MAX_ATTEMPTS = 3;       // includes the first attempt, not just retries
const BASE_DELAY_MS = 250;    // multiplied by attempt number — linear backoff
const TIMEOUT_MS = 5_000;     // aborts the attempt; queued work is not cancelled
```

```ts
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Calls `fn`, retrying with linear backoff if it rejects.
 *
 * @param fn - Operation to attempt; called fresh on every retry
 * @param maxAttempts - Total attempts allowed, including the first
 * @returns Resolved value of the first attempt that succeeds
 * @throws The last rejection, once every attempt has failed
 * @see {@link sleep} — Node's promise-based timer, awaited between attempts
 */
export async function retry<T>(fn: () => Promise<T>, maxAttempts: number): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
  throw new Error('unreachable');
}
```

## Checklist

- [ ] Exported, long, or needs `{@link}`? Use a TSDoc block — otherwise a trailing `//` is enough.
- [ ] Does the summary say *why*, not *what* the name already says?
- [ ] Do `@param`/`@returns` describe meaning, not repeat the type?
- [ ] Does a non-obvious library call get a `{@link}` to its declaration, not a web URL?
- [ ] In an aligned block of trailing comments, does every line have one?
