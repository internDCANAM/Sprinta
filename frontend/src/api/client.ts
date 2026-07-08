import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { getAccessToken, setAccessToken } from "../auth/tokenStore";
import type { ApiErrorBody, RefreshResponse } from "@sprintaiso/api-types";

export const api: AxiosInstance = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    const headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

// --- Refresh-kö: om flera requests får 401 samtidigt ska vi bara göra
// ETT refresh-anrop och låta alla vänta på det.

let refreshInFlight: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = axios
    .post<RefreshResponse>(
      "/api/v1/auth/refresh",
      {},
      { withCredentials: true },
    )
    .then((res) => {
      const token = res.data.accessToken;
      setAccessToken(token);
      return token;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<ApiErrorBody>) => {
    const original = err.config as RetriableConfig | undefined;
    const status = err.response?.status;

    // Försök inte förnya på själva auth-endpointsen — det loopar.
    const isAuthRoute =
      typeof original?.url === "string" && original.url.includes("/auth/");

    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      const fresh = await refreshToken();
      if (fresh) {
        const headers =
          original.headers instanceof AxiosHeaders
            ? original.headers
            : new AxiosHeaders(original.headers);
        headers.set("Authorization", `Bearer ${fresh}`);
        original.headers = headers;
        return api.request(original);
      }
    }

    return Promise.reject(err);
  },
);

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    return err.response?.data?.error ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return "Ett oväntat fel inträffade";
}
