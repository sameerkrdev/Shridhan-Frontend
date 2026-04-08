import axios from "axios";

type ErrorResponseShape = {
  message?: string;
  error?: string;
  details?: unknown;
};

type ZodTreeNode = {
  errors?: unknown;
  properties?: Record<string, ZodTreeNode>;
};

export const getApiErrorMessage = (error: unknown, fallback = "Something went wrong") => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

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

const extractFieldErrorsFromNode = (
  node: ZodTreeNode | undefined,
  prefix: string[],
  collector: Record<string, string>,
) => {
  if (!node) {
    return;
  }

  const maybeErrors = node.errors;
  if (Array.isArray(maybeErrors) && maybeErrors.length > 0) {
    const firstError = maybeErrors.find((item) => typeof item === "string");
    if (typeof firstError === "string" && prefix.length > 0) {
      collector[prefix.join(".")] = firstError;
    }
  }

  if (!node.properties) {
    return;
  }

  Object.entries(node.properties).forEach(([key, childNode]) => {
    extractFieldErrorsFromNode(childNode, [...prefix, key], collector);
  });
};

export const getApiValidationErrors = (error: unknown): Record<string, string> => {
  if (!axios.isAxiosError(error)) {
    return {};
  }

  const data = error.response?.data as ErrorResponseShape | undefined;
  if (!data?.details || typeof data.details !== "object") {
    return {};
  }

  const details = data.details as ZodTreeNode;
  const fieldErrors: Record<string, string> = {};
  const bodyNode = details.properties?.body;

  extractFieldErrorsFromNode(bodyNode, [], fieldErrors);
  return fieldErrors;
};
