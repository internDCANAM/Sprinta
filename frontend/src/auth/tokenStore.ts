// JWT lagras BARA i minne (ingen localStorage/sessionStorage), vilket gör att
// en XSS inte kan läsa ut tokenen. Refresh-tokenen ligger i httpOnly-cookie
// och plockas upp automatiskt av webbläsaren när axios-klienten anropar
// /api/v1/auth/refresh.

let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  listeners.forEach((l) => l(token));
}

export function subscribeToken(fn: (token: string | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
