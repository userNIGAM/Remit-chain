const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

const getCsrfToken = (): string | null => {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);

  return match ? decodeURIComponent(match[1]) : null;
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
    const csrfToken = getCsrfToken();
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
