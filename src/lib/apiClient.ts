import axios, { AxiosHeaders } from "axios";
import { useAuthSessionStore } from "@/store/authSessionStore";

const baseURL = import.meta.env.VITE_API_BASE_URL;

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
});

apiClient.interceptors.request.use((config) => {
  const societyId = useAuthSessionStore.getState().selectedMembership?.societyId;
  if (!societyId) return config;

  const headers = AxiosHeaders.from(config.headers ?? {});
  if (headers.get("x-society-id")) return config;

  headers.set("x-society-id", societyId);
  config.headers = headers;
  return config;
});

let refreshPromise: Promise<void> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as {
      _retry?: boolean;
      headers?: Record<string, string>;
      url?: string;
    };
    const status = error.response?.status as number | undefined;

    if (status === 403) {
      return Promise.reject(error);
    }

    if (status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    if (originalRequest?.url?.includes("/members/refresh")) {
      useAuthSessionStore.getState().clearSession();
      return Promise.reject(error);
    }

    const { clearSession } = useAuthSessionStore.getState();

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${baseURL}/members/refresh`, {}, { withCredentials: true })
          .then(() => undefined)
          .finally(() => {
            refreshPromise = null;
          });
      }

      await refreshPromise;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearSession();
      return Promise.reject(refreshError);
    }
  },
);
