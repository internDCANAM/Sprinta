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
import type { AuthUser, RefreshResponse } from "@sprintaiso/shared";
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

  // Vid första render: försök byta refresh-cookien mot ett access token så
  // att användaren stannar inloggad över en reload.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.post<RefreshResponse>(
          "/api/v1/auth/refresh",
          {},
          { withCredentials: true },
        );
        if (cancelled) return;
        setAccessToken(res.data.accessToken);
        // Access-tokenen innehåller vårt user-id men vi hämtar det säkert
        // genom att dekoda payload (utan att validera — servern är källa
        // till sanning vid varje API-anrop).
        const payload = decodeJwtPayload(res.data.accessToken);
        if (payload) {
          setUser({
            id: payload.userId,
            email: "",
            name: "",
            role: payload.role,
            customerId: payload.customerId,
          });
        }
      } catch {
        // Ingen giltig refresh-cookie — användaren är utloggad.
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
      // Ignorera — vi nollar lokalt ändå.
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
