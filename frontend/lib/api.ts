const RAW_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Tolerate a base URL that is missing the trailing "/api" (an easy deployment
// mistake) so requests always hit the API mount point instead of 404/403ing on
// the bare host.
const trimmedBaseUrl = RAW_API_URL.replace(/\/+$/, "");
const API_URL = trimmedBaseUrl.endsWith("/api")
  ? trimmedBaseUrl
  : `${trimmedBaseUrl}/api`;

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

// The CSRF token is returned in the login response body so the client can use
// it even when the API is on a different origin (e.g. Vercel frontend + Render
// backend), where document.cookie cannot read the API's own cookie. The cookie
// is still consulted as a fallback for same-origin setups.
const CSRF_STORAGE_KEY = "csrfToken";

let csrfTokenMemory: string | null = null;

const readCsrfToken = (): string | null => {
  if (csrfTokenMemory) return csrfTokenMemory;

  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(CSRF_STORAGE_KEY);
    if (stored) return stored;
  }

  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
};

export const setCsrfToken = (token: string | null): void => {
  csrfTokenMemory = token;

  if (typeof window === "undefined") return;

  if (token) {
    window.localStorage.setItem(CSRF_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(CSRF_STORAGE_KEY);
  }
};

const getErrorMessage = (data: unknown, status: number): string => {
  if (
    data !== null &&
    typeof data === "object" &&
    "message" in data &&
    typeof (data as { message?: unknown }).message === "string"
  ) {
    return (data as { message: string }).message;
  }

  return `Request failed with status ${status}`;
};

export const api = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  const method = (options.method || "GET").toUpperCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!SAFE_METHODS.includes(method)) {
    const csrfToken = readCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      method,
      credentials: "include",
      headers,
    });
  } catch {
    throw new Error("Network error. Please check your connection.");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }

  return data as T;
};
