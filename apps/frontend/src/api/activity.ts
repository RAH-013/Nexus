export type ActivityOrder = "asc" | "desc";

export interface RecentView {
  externalId: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  date: string;
}

export interface RecentComment {
  id: number;
  text: string;
  externalId: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  date: string;
}

export interface RecentActorComment {
  id: number;
  text: string;
  actorName: string;
  imageUrl?: string;
  date: string;
}

export interface ActivityPage<T> {
  items: T[];
  nextCursor: string | null;
}

export type ActivityError =
  | "timeout"
  | "http"
  | "unauthorized"
  | "rate-limit"
  | "network"
  | "aborted";

export type ActivityApiResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ActivityError };

const API_URL = "";

/** El frontend aborta a los 10 s (mismo criterio que api/comments.ts). */
const REQUEST_TIMEOUT_MS = 10_000;

function failure<T>(error: ActivityError): ActivityApiResult<T> {
  return { success: false, data: null, error };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecentTitle(value: unknown): RecentView | null {
  if (!isObject(value)) {
    return null;
  }

  const { externalId, type, name, poster, date } = value;

  if (
    typeof externalId !== "string" ||
    (type !== "movie" && type !== "series") ||
    typeof name !== "string" ||
    typeof date !== "string"
  ) {
    return null;
  }

  return {
    externalId,
    type,
    name,
    ...(typeof poster === "string" ? { poster } : {}),
    date,
  };
}

function parseRecentComment(value: unknown): RecentComment | null {
  const title = parseRecentTitle(value);

  if (!title || !isObject(value)) {
    return null;
  }

  const { id, text } = value;

  if (typeof id !== "number" || typeof text !== "string") {
    return null;
  }

  return { ...title, id, text };
}

function parseRecentActorComment(value: unknown): RecentActorComment | null {
  if (!isObject(value)) {
    return null;
  }

  const { id, text, actorName, imageUrl, date } = value;

  if (
    typeof id !== "number" ||
    typeof text !== "string" ||
    typeof actorName !== "string" ||
    typeof date !== "string"
  ) {
    return null;
  }

  return {
    id,
    text,
    actorName,
    ...(typeof imageUrl === "string" ? { imageUrl } : {}),
    date,
  };
}

/** Página completa: todas las tarjetas deben parsear, o la página es nula. */
function parsePage<T>(
  payload: unknown,
  parseItem: (value: unknown) => T | null,
): ActivityPage<T> | null {
  if (!isObject(payload) || !Array.isArray(payload.items)) {
    return null;
  }

  const items: T[] = [];

  for (const value of payload.items) {
    const item = parseItem(value);

    if (item === null) {
      return null;
    }

    items.push(item);
  }

  return {
    items,
    nextCursor:
      typeof payload.nextCursor === "string" ? payload.nextCursor : null,
  };
}

async function request<T>(
  endpoint: string,
  options: RequestInit,
  parse: (payload: unknown) => T | null,
): Promise<ActivityApiResult<T>> {
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

    return data === null
      ? failure("http")
      : { success: true, data, error: null };
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

function activityPath(
  row: "views" | "comments" | "actor-comments",
  order: ActivityOrder,
  cursor: string | null,
): string {
  const params = new URLSearchParams({ order });

  if (cursor !== null) {
    params.set("cursor", cursor);
  }

  return `/api/activity/${row}?${params.toString()}`;
}

export function apiGetRecentViews(
  order: ActivityOrder,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<ActivityApiResult<ActivityPage<RecentView>>> {
  return request(
    activityPath("views", order, cursor),
    { signal },
    (payload) => parsePage(payload, parseRecentTitle),
  );
}

export function apiGetRecentComments(
  order: ActivityOrder,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<ActivityApiResult<ActivityPage<RecentComment>>> {
  return request(
    activityPath("comments", order, cursor),
    { signal },
    (payload) => parsePage(payload, parseRecentComment),
  );
}

export function apiGetRecentActorComments(
  order: ActivityOrder,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<ActivityApiResult<ActivityPage<RecentActorComment>>> {
  return request(
    activityPath("actor-comments", order, cursor),
    { signal },
    (payload) => parsePage(payload, parseRecentActorComment),
  );
}