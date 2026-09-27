/** Tiny fetch wrapper for the Django API: JSON in/out, session cookies and CSRF. */

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
  query?: Query;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(messageFrom(data) ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }

  /** Field -> first message, for showing errors next to form inputs. */
  get fields(): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.data && typeof this.data === "object" && !Array.isArray(this.data)) {
      for (const [key, value] of Object.entries(this.data as Record<string, unknown>)) {
        if (key === "detail" || key === "code") continue;
        const text = Array.isArray(value) ? value[0] : value;
        if (typeof text === "string") out[key] = text;
      }
    }
    return out;
  }

  get code(): string | undefined {
    const data = this.data as { code?: unknown } | null;
    return typeof data?.code === "string" ? data.code : undefined;
  }
}

function messageFrom(data: unknown): string | undefined {
  if (!data) return undefined;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return typeof data[0] === "string" ? data[0] : undefined;
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    const nonField = record.non_field_errors;
    if (Array.isArray(nonField) && typeof nonField[0] === "string") return nonField[0];
    for (const value of Object.values(record)) {
      const text = Array.isArray(value) ? value[0] : value;
      if (typeof text === "string") return text;
    }
  }
  return undefined;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "Can't reach the server. Is it running?";
  return fallback;
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

let csrfRequest: Promise<unknown> | null = null;

async function csrfToken(): Promise<string> {
  if (!readCookie("csrftoken")) {
    csrfRequest ??= fetch("/api/auth/csrf/", { credentials: "same-origin" }).finally(() => {
      csrfRequest = null;
    });
    await csrfRequest;
  }
  return readCookie("csrftoken") ?? "";
}

function buildUrl(path: string, query?: Query): string {
  const url = `/api${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;

  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (method !== "GET") headers["X-CSRFToken"] = await csrfToken();

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    body,
    credentials: "same-origin",
    signal: options.signal,
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}
