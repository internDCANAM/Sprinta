import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AccessTokenPayload, AuthUser } from '@sprintaiso/api-types';
import { setAccessToken } from './tokenStore';
import { fetchMe, loginRequest, logoutRequest } from '../api/endpoints';
import { refreshToken } from '../api/client';

// shape handed back by useAuth()
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

// null default (never a placeholder AuthContextValue) is what lets useAuth()
// detect a call outside <AuthProvider> and throw instead of handing back
// something that merely looks valid.
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Wraps the app and exposes the current session via {@link useAuth}. Mounted
 * once, above every route including `/login` in `App.tsx`, so it owns the
 * access token lifecycle: silent refresh on load, {@link loginRequest}
 * on sign-in, {@link logoutRequest} on sign-out.
 */
export function AuthProvider({ children }: { children: ReactNode; }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * On first render, silently exchanges the httpOnly refresh cookie for an
   * access token so a page reload doesn't bounce a logged-in user to
   * `/login`. {@link refreshToken}'s response only carries the token, not a
   * user — {@link decodeJwtPayload} reads `locale` off it, but `email`/`name`
   * aren't in the JWT, so those come from a follow-up {@link fetchMe} call.
   * `cancelled` guards the `setUser`/`setLoading` calls against firing after
   * this component has already unmounted.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await refreshToken();
      const payload = token ? decodeJwtPayload(token) : null;
      if (payload) {
        const profile = await fetchMe().catch(() => null);
        if (profile && !cancelled) {
          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            locale: payload.locale,
            isAdmin: profile.isAdmin,
          });
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginRequest(email, password);
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch { }
    setAccessToken(null);
    setUser(null);
  }, []);

  // memoized so consumers of useAuth() don't re-render on every AuthProvider
  // render — only when one of these four actually changes
  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Reads the current session. Throws outside {@link AuthProvider} so callers
 * can destructure `{ user, ... }` directly instead of null-checking a context
 * that should never actually be absent, given `App.tsx`'s tree.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth within <AuthProvider>');
  return ctx;
}

/**
 * Reads a JWT's claims without verifying its signature — safe here only
 * because the result is used purely to pre-populate UI state optimistically.
 * The actual security boundary is the backend's `verifyAccessToken`, checked
 * against the real secret on every API call; a forged token decoded here
 * grants nothing, since no backend route trusts this function's output.
 */
function decodeJwtPayload(token: string): AccessTokenPayload | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}
