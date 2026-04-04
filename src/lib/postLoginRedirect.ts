const POST_LOGIN_REDIRECT_KEY = "post_login_redirect_path";

const normalizeInternalPath = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
    return decoded;
  } catch {
    return null;
  }
};

export const setPendingPostLoginRedirect = (path: string | null | undefined) => {
  const normalized = normalizeInternalPath(path);
  if (!normalized) return;
  localStorage.setItem(POST_LOGIN_REDIRECT_KEY, normalized);
};

export const consumePendingPostLoginRedirect = (): string | null => {
  const value = localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return normalizeInternalPath(value);
};

export const readRedirectFromSearch = (search: string): string | null => {
  const params = new URLSearchParams(search);
  return normalizeInternalPath(params.get("redirect"));
};

