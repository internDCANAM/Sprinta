import axios, { AxiosError, AxiosHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, setAccessToken } from '../auth/tokenStore';
import { csrfHeaders, getCsrfToken } from './csrf';
import { en, sv } from '@sprintaiso/dict';
import type { ApiErrorBody, Locale, RefreshResponse } from '@sprintaiso/api-types';

export const api: AxiosInstance = axios.create({ baseURL: '/api/v1', withCredentials: true });

api.interceptors.request.use((config) => {
  const headers = config.headers instanceof AxiosHeaders
    ? config.headers
    : new AxiosHeaders(config.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const csrf = getCsrfToken();
  if (csrf) headers.set('x-csrf-token', csrf);
  config.headers = headers;
  return config;
});

/**
 * Calls the refresh endpoint on the base `axios` client rather than through
 * {@link api}. Going through `api` would re-enter its own response
 * interceptor on a failing refresh, calling this function again — an
 * infinite loop. Resolves with `null` instead of rejecting on failure so
 * callers can branch with a plain `if` instead of a try/catch.
 */
async function performRefresh(): Promise<string | null> {
  try {
    const { data } = await axios.post<RefreshResponse>(
      '/api/v1/auth/refresh', {}, { withCredentials: true, headers: csrfHeaders() });
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}

let refreshInFlight: Promise<string | null> | null = null; // shared until it settles

/**
 * De-duplicates concurrent refresh attempts. Several {@link api} calls can
 * 401 at once when the access token expires — without this, each would race
 * to spend the same single-use refresh cookie, and only the first would
 * succeed. Callers within the same refresh cycle all await the one
 * in-flight {@link performRefresh} call instead of firing their own;
 * `refreshInFlight` clears once it settles, so the next expiry starts fresh.
 */
export async function refreshToken(): Promise<string | null> {
  refreshInFlight ??= performRefresh().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean; // marks a request already retried once, so a second 401 isn't retried again
};

/**
 * On a 401 from any non-auth route, tries one silent {@link refreshToken}
 * and replays the original request with the new access token. Requests
 * already retried once (`_retry`) or aimed at `/auth/*` itself are left
 * alone — retrying those would either loop or refresh on a call that was
 * never meant to carry an access token in the first place.
 */
api.interceptors.response.use((res) => res, async (err: AxiosError<ApiErrorBody>) => {
  const original = err.config as RetriableConfig | undefined;
  const status = err.response?.status;
  const isAuthRoute = typeof original?.url === 'string' && original.url.includes('/auth/');

  if (status === 401 && original && !original._retry && !isAuthRoute) {
    original._retry = true;
    const fresh = await refreshToken();
    if (fresh) {
      const headers = original.headers instanceof AxiosHeaders
        ? original.headers
        : new AxiosHeaders(original.headers);
      headers.set('Authorization', `Bearer ${fresh}`);
      original.headers = headers;
      return api.request(original);
    }
  }

  return Promise.reject(err);
});

/**
 * Pulls a human-readable message out of a thrown value.
 *
 * The first two branches already carry their own message: the backend's own
 * translated {@link ApiErrorBody.error}, for a structured API failure —
 * already in the right language, chosen server-side by `resolveLocale` — or
 * a plain `Error#message` for anything else recognizable. Only the
 * catch-all fallback has no message to read, so `locale` only matters there.
 */
export function extractErrorMessage(err: unknown, locale: Locale): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) return err.response?.data?.error ?? err.message;
  if (err instanceof Error) return err.message;
  return { en, sv }[locale].http.internalError;
}
