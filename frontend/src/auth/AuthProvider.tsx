import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";
import type { AuthUser, RefreshResponse } from "@sprintaiso/api-types";
import { getAccessToken, setAccessToken } from "./tokenStore";
import { loginRequest, logoutRequest } from "../api/endpoints";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On first render: try to exchange the refresh cookie for an access token
  // so the user stays logged in across a reload.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await axios.post<RefreshResponse>(
          "/api/v1/auth/refresh",
          {},
          { withCredentials: true },
        );
        if (cancelled) return;
        setAccessToken(res.data.accessToken);
        // The access token carries our user id, but we read it safely by
        // decoding the payload (without validating it — the server is the
        // source of truth on every API call).
        const payload = decodeJwtPayload(res.data.accessToken);
        if (payload) {
          setUser({
            id: payload.userId,
            email: "",
            name: "",
            role: payload.role,
            customerId: payload.customerId,
            locale: payload.locale,
          });
        }
      } catch {
        // No valid refresh cookie — the user is logged out.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    } catch {
      // Ignore — we clear local state regardless.
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth måste användas inom <AuthProvider>");
  return ctx;
}

interface JwtPayload {
  userId: string;
  role: AuthUser["role"];
  customerId: string | null;
  locale: AuthUser["locale"];
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export { getAccessToken };
