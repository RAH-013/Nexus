import type { MediaType } from "./cinemeta";

const API_URL = "";

/** El frontend aborta a los 10 s (mismo criterio que api/cinemeta.ts). */
const REQUEST_TIMEOUT_MS = 10_000;

export interface CommentEntry {
  id: number;
  text: string;
  author: string;
}

/**
 * `unauthorized` clasifica el 401 (sesión ausente o caducada) y `rate-limit`
 * el 429; los demás errores imitan a los de `api/cinemeta.ts`.
 */
export type CommentsError =
  | "timeout"
  | "http"
  | "unauthorized"
  | "rate-limit"
  | "network"
  | "aborted";

export type CommentsApiResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: CommentsError };

function failure<T>(error: CommentsError): CommentsApiResult<T> {
  return { success: false, data: null, error };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCommentEntry(value: unknown): value is CommentEntry {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "number" &&
    typeof value.text === "string" &&
    typeof value.author === "string"
  );
}

function parseCommentList(payload: unknown): CommentEntry[] | null {
  if (!isObject(payload) || !Array.isArray(payload.comments)) {
    return null;
  }

  return payload.comments.every(isCommentEntry) ? payload.comments : null;
}

function parseComment(payload: unknown): CommentEntry | null {
  return isCommentEntry(payload) ? payload : null;
}

async function request<T>(
  endpoint: string,
  options: RequestInit,
  parse: (payload: unknown) => T | null,
): Promise<CommentsApiResult<T>> {
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

export function apiGetComments(
  type: MediaType,
  id: string,
  signal?: AbortSignal,
): Promise<CommentsApiResult<CommentEntry[]>> {
  return request(
    `/api/comments/${type}/${encodeURIComponent(id)}`,
    { signal },
    parseCommentList,
  );
}

export function apiPostComment(
  type: MediaType,
  id: string,
  text: string,
  signal?: AbortSignal,
): Promise<CommentsApiResult<CommentEntry>> {
  return request(
    `/api/comments/${type}/${encodeURIComponent(id)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    },
    parseComment,
  );
}

/** Comentarios de un actor (perfil `/actor/:name`). */
export function apiGetActorComments(
  name: string,
  signal?: AbortSignal,
): Promise<CommentsApiResult<CommentEntry[]>> {
  return request(
    `/api/actors/${encodeURIComponent(name)}/comments`,
    { signal },
    parseCommentList,
  );
}

export function apiPostActorComment(
  name: string,
  text: string,
  signal?: AbortSignal,
): Promise<CommentsApiResult<CommentEntry>> {
  return request(
    `/api/actors/${encodeURIComponent(name)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    },
    parseComment,
  );
}
