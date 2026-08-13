import type { Request, Response, NextFunction } from 'express';
import { languages, createTranslator, DEFAULT_LOCALE, type Locale } from '../lib/i18n.js';

const VALID_LOCALE = Object.keys(languages);
function validLocale(locale: string): locale is Locale { return VALID_LOCALE.includes(locale); }

export function extractLocale(req: Request): Locale | undefined {
  if (req.user?.locale && validLocale(req.user.locale)) return req.user.locale;
  const cookies = req.cookies as Record<string, unknown> | undefined;
  if (cookies && typeof cookies.locale === 'string') {
    const cookieLocale = cookies.locale.toLowerCase();
    if (validLocale(cookieLocale)) return cookieLocale;
  }

  const acceptLang = req.headers['accept-language'];
  if (typeof acceptLang === 'string') {
    const preferences = acceptLang.split(',').map((lang) => {
      const primaryLang = lang.trim().split('-')[0] || '';
      return primaryLang.toLowerCase();
    });

    return preferences.find(validLocale);
  }

  return undefined;
}

/**
 * The locale to actually use for a request — {@link extractLocale} reports
 * what was asked for, this decides what happens when nothing was.
 */
export function resolveLocale(req: Request): Locale { return extractLocale(req) ?? DEFAULT_LOCALE; }
export function i18n(req: Request, res: Response, next: NextFunction) {
  req.t = createTranslator(resolveLocale(req));
  next();
}
