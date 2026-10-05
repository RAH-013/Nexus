const API_URL = "";

/** El frontend aborta a los 10 s (mismo criterio que api/cinemeta.ts). */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Películas marcadas como vistas por el usuario en sesión (spec 003, RF-8):
 * `ids` son los `externalId` de las películas con `UserAction` VIEW.
 */
export interface ViewsData {
  ids: string[];
}

export interface ViewActionData {
  message: string;
}

/**
 * `unauthorized` clasifica el 401 (sesión ausente o caducada) y `rate-limit`
 * el 429; los demás errores imitan a los de `api/cinemeta.ts`.
 */
export type ViewsError =
  | "timeout"
  | "http"
  | "unauthorized"
  | "rate-limit"
  | "network"
  | "aborted";

export type ViewsApiResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ViewsError };

function failure<T>(error: ViewsError): ViewsApiResult<T> {
  return { success: false, data: null, error };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseViewsData(payload: unknown): ViewsData | null {
  if (!isObject(payload) || !Array.isArray(payload.ids)) {
    return null;
  }

  return payload.ids.every((id) => typeof id === "string") ? { ids: payload.ids } : null;
}

function parseViewAction(payload: unknown): ViewActionData | null {
  if (!isObject(payload) || typeof payload.message !== "string") {
    return null;
  }

  return { message: payload.message };
}

async function request<T>(
  endpoint: string,
  options: RequestInit,
  parse: (payload: unknown) => T | null,
): Promise<ViewsApiResult<T>> {
  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  try {
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, signal });

    if (response.status === 429) {
      return failure("rate-limit");
    }

    if (response.status === 401) {
      return failure("unauthorized");
    }

    if (!response.ok) {
      return failure("http");
    }

    const payload: unknown = await response.json();
    const data = parse(payload);

    return data === null ? failure("http") : { success: true, data, error: null };
  } catch (error) {
    if (timedOut) {
      return failure("timeout");
    }

    if (error instanceof Error && error.name === "AbortError") {
      return failure("aborted");
    }

    return failure(error instanceof SyntaxError ? "http" : "network");
  } finally {
    clearTimeout(timeoutId);
  }
}

export function apiGetViews(signal?: AbortSignal): Promise<ViewsApiResult<ViewsData>> {
  return request("/api/views", { signal }, parseViewsData);
}

export function apiMarkViewed(
  id: string,
  signal?: AbortSignal,
): Promise<ViewsApiResult<ViewActionData>> {
  return request(`/api/views/movie/${encodeURIComponent(id)}`, { method: "PUT", signal }, parseViewAction);
}

export function apiUnmarkViewed(
  id: string,
  signal?: AbortSignal,
): Promise<ViewsApiResult<ViewActionData>> {
  return request(
    `/api/views/movie/${encodeURIComponent(id)}`,
    { method: "DELETE", signal },
    parseViewAction,
  );
}