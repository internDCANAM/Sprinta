import { en } from './dict/en.js';
import { sv } from './dict/sv.js';

export const languages = { en, sv };
export type Locale = keyof typeof languages;

/**
 * Recursive type hack that makes TypeScript do something it really ought to
 * support natively: keep full hover info and autocomplete for keys that
 * exist, while still compiling cleanly for keys that don't — exactly the
 * kind of thing you'd think a structural type system would have a primitive
 * for by now.
 *
 * Known keys keep their real type (down to the literal string, for hover).
 * Anything else falls through the index signature as `Fluid` — a value
 * that's typed as `string` but stays indexable at any depth, so a
 * not-yet-declared path like `req.t.made.up.path` still resolves to a
 * string type instead of a compiler error.
 */
type Fluid = string & { [key: string]: Fluid };

type DeepFluid<T> = T extends object
  ? { [K in keyof T]: DeepFluid<T[K]> } & Record<string, Fluid>
  : T;

/**
 * A recursive {@link Proxy} factory that intercepts object property access.
 * Instead of crashing or returning `undefined` when a missing key is accessed,
 * it safely catches the request and generates a temporary placeholder string.
 *
 * Every nested object read re-wraps the next level in a fresh
 * {@link createFluidProxy} call, which is what lets {@link DeepFluid} keep
 * hover info and autocomplete working arbitrarily deep, not just at the
 * dictionary's top level.
 *
 * @param target - The current nested level of the locale dictionary being
 *                 accessed
 * @param key -    The accumulated dot-notation path used to build placeholders.
 *
 * ---
 * @returns
 * - Bypasses the proxy and returns the native property if a {@link Symbol} is
 *   requested (prevents JS engine crashes).
 * - A new wrapped Proxy if the accessed property is a deeper nested object.
 * - The actual translated string if the key exists in the dictionary.
 * - A fallback `[WIP: key.prop]` string if the key does not exist.
 *
 * ---
 * @see {@link getLocale} — resolves a {@link Locale} to its dictionary before
 *                          wrapping it here
 * @see {@link DeepFluid} — the type-level counterpart that makes this
 *                          function's untyped `unknown` return hoverable and
 *                          autocomplete-able at every call site
 */
function createFluidProxy(target: Record<string, unknown>, key: string = ''): unknown {
  return new Proxy(target, {
    get(obj, prop: string) {
      if (typeof prop === 'symbol') return Reflect.get(obj, prop);
      if (prop in obj) {
        const value = obj[prop];
        return typeof value === 'object'
          ? createFluidProxy(value as Record<string, unknown>, key ? `${key}.${prop}` : prop)
          : value;
      }
      return `[WIP: ${key ? `${key}.` : ''}${prop}]`;
    },
  });
}

export function createTranslator(locale: Locale = 'en') {
  return createFluidProxy(languages[locale]) as DeepFluid<typeof en>;
}
