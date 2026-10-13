import type { MediaType } from "./cinemeta";

const API_URL = "";

/** El frontend aborta a los 20 s (Gemini puede tardar ~10 s en el peor caso). */
const REQUEST_TIMEOUT_MS = 20_000;

/** De dónde salió la lista (RF-12): Gemini, heurística local o sin actividad. */
export type ForYouSource = "gemini" | "heuristic" | "empty";

/** Recomendación de `GET /api/recommendations/for-you` (RF-12). */
export interface ForYouItem {
  id: string;
  type: MediaType;
  name: string;
  poster?: string;
  year?: string;
  score: number;
  reason: string;
}

export interface ForYouData {
  items: ForYouItem[];
  source: ForYouSource;
  cachedAt: string;
}

/**
 * `unauthorized` clasifica el 401 (sesión ausente o caducada) y `rate-limit`
 * el 429; los demás errores imitan a los de `api/reactions.ts`.
 */
export type ForYouError =
  | "timeout"
  | "http"
  | "unauthorized"
  | "rate-limit"
  | "network"
  | "aborted";

export type ForYouApiResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ForYouError };

function failure<T>(error: ForYouError): ForYouApiResult<T> {
  return { success: false, data: null, error };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isForYouItem(value: unknown): value is ForYouItem {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    (value.type === "movie" || value.type === "series") &&
    typeof value.name === "string" &&
    isOptionalString(value.poster) &&
    isOptionalString(value.year) &&
    typeof value.score === "number" &&
    typeof value.reason === "string"
  );
}

function parseForYouData(payload: unknown): ForYouData | null {
  if (
    !isObject(payload) ||
    !Array.isArray(payload.items) ||
    !payload.items.every(isForYouItem) ||
    (payload.source !== "gemini" &&
      payload.source !== "heuristic" &&
      payload.source !== "empty") ||
    typeof payload.cachedAt !== "string"
  ) {
    return null;
  }

  return {
    items: payload.items,
    source: payload.source,
    cachedAt: payload.cachedAt,
  };
}

async function request<T>(
  endpoint: string,
  signal: AbortSignal | undefined,
  parse: (payload: unknown) => T | null,
): Promise<ForYouApiResult<T>> {
  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const requestSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      signal: requestSignal,
    });

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

/**
 * Recomendaciones «Para ti» (RF-12): `refresh = true` añade `?refresh=1` para
 * invalidar la caché de Redis y forzar el recálculo (RF-14).
 */
export function apiGetForYou(
  refresh = false,
  signal?: AbortSignal,
): Promise<ForYouApiResult<ForYouData>> {
  const query = refresh ? "?refresh=1" : "";
  return request(`/api/recommendations/for-you${query}`, signal, parseForYouData);
}
