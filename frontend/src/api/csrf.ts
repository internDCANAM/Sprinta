const CSRF_COOKIE_NAME = 'csrf_token';

export function getCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function csrfHeaders(): Record<string, string> {
  return { 'x-csrf-token': getCsrfToken() ?? '' };
}
