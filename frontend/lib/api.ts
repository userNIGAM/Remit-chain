const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

const getCsrfToken = (): string | null => {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);

  return match ? decodeURIComponent(match[1]) : null;
};

export const api = async <T = any>(
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

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message || `Request failed with status ${response.status}`,
    );
  }

  return data as T;
};
