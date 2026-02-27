import axios from "axios";

type ErrorResponseShape = {
  message?: string;
  error?: string;
  details?: unknown;
};

export const getApiErrorMessage = (error: unknown, fallback = "Something went wrong") => {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const data = error.response?.data as ErrorResponseShape | undefined;
  if (typeof data?.message === "string" && data.message.trim().length > 0) {
    return data.message;
  }

  if (typeof data?.error === "string" && data.error.trim().length > 0) {
    return data.error;
  }

  return fallback;
};
