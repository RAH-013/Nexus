import type { MediaType } from "./cinemeta";

const API_URL = "";

/** El frontend aborta a los 10 s (mismo criterio que api/views.ts). */
const REQUEST_TIMEOUT_MS = 10_000;

/** Reacciones de la ficha (spec 004, RF-1): mismos nombres que el backend. */
export type ReactionKind = "favorite" | "like" | "dislike";

/**
 * `externalId` de los títulos con FAVORITE, LIKE y DISLIKE del usuario en
 * sesión (`GET /api/reactions`).
 */
export interface ReactionsData {
  favorites: string[];
  likes: string[];
  dislikes: string[];
}

export interface ReactionActionData {
  message: string;
}

/**
 * `unauthorized` clasifica el 401 (sesión ausente o caducada) y `rate-limit`
 * el 429; los demás errores imitan a los de `api/views.ts`.
 */
export type ReactionsError =
  | "timeout"
  | "http"
  | "unauthorized"
  | "rate-limit"
  | "network"
  | "aborted";

export type ReactionsApiResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ReactionsError };

function failure<T>(error: ReactionsError): ReactionsApiResult<T> {
  return { success: false, data: null, error };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseReactionsData(payload: unknown): ReactionsData | null {
  if (
    !isObject(payload) ||
    !isStringArray(payload.favorites) ||
    !isStringArray(payload.likes) ||
    !isStringArray(payload.dislikes)
  ) {
    return null;
  }

  return {
    favorites: payload.favorites,
    likes: payload.likes,
    dislikes: payload.dislikes,
  };
}

function parseReactionAction(payload: unknown): ReactionActionData | null {
  if (!isObject(payload) || typeof payload.message !== "string") {
    return null;
  }

  return { message: payload.message };
}

async function request<T>(
  endpoint: string,
  options: RequestInit,
  parse: (payload: unknown) => T | null,
): Promise<ReactionsApiResult<T>> {
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

/** Favoritos, me gusta y no me gusta del usuario en sesión (RF-4). */
export function apiGetReactions(
  signal?: AbortSignal,
): Promise<ReactionsApiResult<ReactionsData>> {
  return request("/api/reactions", { signal }, parseReactionsData);
}

/**
 * Escribe (o borra) una reacción según `on` (RF-2): PUT la crea, DELETE la
 * quita. El backend se encarga de la exclusión mutua like↔dislike.
 */
export function apiSetReaction(
  kind: ReactionKind,
  type: MediaType,
  id: string,
  on: boolean,
): Promise<ReactionsApiResult<ReactionActionData>> {
  return request(
    `/api/reactions/${kind}/${type}/${encodeURIComponent(id)}`,
    { method: on ? "PUT" : "DELETE" },
    parseReactionAction,
  );
}
