import axios from "axios";
import { useAuthSessionStore } from "@/store/authSessionStore";
import type { AuthResponse } from "@/types/auth";

const baseURL = import.meta.env.VITE_API_BASE_URL;

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshPromise: Promise<AuthResponse> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as {
      _retry?: boolean;
      headers?: Record<string, string>;
      url?: string;
    };
    const status = error.response?.status as number | undefined;

    if (status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    if (originalRequest?.url?.includes("/members/refresh")) {
      useAuthSessionStore.getState().clearSession();
      return Promise.reject(error);
    }

    const { clearSession, setAuthPayload } = useAuthSessionStore.getState();

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post<AuthResponse>(
            `${baseURL}/members/refresh`,
            {},
            { withCredentials: true },
          )
          .then((response) => response.data)
          .finally(() => {
            refreshPromise = null;
          });
      }

      const refreshed = await refreshPromise;
      setAuthPayload(refreshed);
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearSession();
      return Promise.reject(refreshError);
    }
  },
);
