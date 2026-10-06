const API_URL = "";

/** El frontend aborta a los 10 s (RF-13, plan D12). */
const REQUEST_TIMEOUT_MS = 10_000;

export type MediaType = "movie" | "series";

export type SearchType = MediaType | "all";

export type Collection =
  | "featured"
  | "trending"
  | "action"
  | "drama"
  | "adventure"
  | "thriller"
  | "comedy"
  | "horror";

/** Pestañas de las vistas Películas y Series. */
export type CatalogList = "trending" | "playing" | "upcoming" | "rated";

/** Alias por retrocompatibilidad */
export type MovieList = CatalogList;
export type SeriesList = CatalogList;

export interface MediaItem {
  id: string;
  type: MediaType;
  name: string;
  poster?: string;
  year?: string;
  /** Géneros en inglés de la fuente: los usan los filtros de Películas/Series. */
  genres?: string[];
}

/** Película referenciada por la card de un actor (vista Actores). */
export interface ActorMovie {
  id: string;
  name: string;
  poster?: string;
}

/** Actor agregado del reparto de todas las películas (vista Actores). */
export interface ActorEntry {
  name: string;
  movieCount: number;
  movies: ActorMovie[];
}

/**
 * Actor con el enriquecimiento de TMDB (foto y biografía). Los campos
 * opcionales vienen ausentes sin clave de API o si TMDB no tiene datos.
 */
export interface ActorDetail extends ActorEntry {
  /** Foto de perfil completa del CDN de TMDB. */
  imageUrl?: string;
  biography?: string;
}

export interface SearchResults {
  results: MediaItem[];
  hasMore: boolean;
  type: SearchType;
}

/** Ficha completa de un título (spec 002 §1.1, la forma que pinta `TitleDetail`). */
export interface TitleDetail {
  id: string;
  type: MediaType;
  name: string;
  poster?: string;
  description?: string;
  year?: string;
  runtime?: string;
  imdbRating?: string;
  genres?: string[];
  director?: string[];
  cast?: string[];
  trailerSource?: string;
}

/**
 * `aborted` no es un error visible: lo produce una cancelación propia (se cambió
 * el texto o se descartó la petición). `not-found` clasifica el 404 de la ficha
 * (spec 002, D8). Los demás son los de plan D12.
 */
export type ApiError =
  | "timeout"
  | "http"
  | "not-found"
  | "rate-limit"
  | "network"
  | "aborted";

export type ApiResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ApiError };

function failure<T>(error: ApiError): ApiResult<T> {
  return { success: false, data: null, error };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isMediaItem(value: unknown): value is MediaItem {
  if (!isObject(value)) {
    return false;
  }

  const type = value.type;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (type === "movie" || type === "series") &&
    (value.poster === undefined || value.poster === null || typeof value.poster === "string") &&
    (value.year === undefined || value.year === null || typeof value.year === "string") &&
    (value.genres === undefined || value.genres === null || isStringArray(value.genres))
  );
}

function parseItems(value: unknown): MediaItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items: MediaItem[] = [];

  for (const entry of value) {
    if (!isMediaItem(entry)) {
      return null;
    }

    items.push(entry);
  }

  return items;
}

function parseMediaItemList(payload: unknown): MediaItem[] | null {
  return parseItems(payload);
}

function parseActorMovies(value: unknown): ActorMovie[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const movies: ActorMovie[] = [];

  for (const entry of value) {
    if (
      !isObject(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.name !== "string" ||
      (entry.poster !== undefined &&
        entry.poster !== null &&
        typeof entry.poster !== "string")
    ) {
      return null;
    }

    movies.push({
      id: entry.id,
      name: entry.name,
      ...(entry.poster ? { poster: entry.poster } : {}),
    });
  }

  return movies;
}

function parseActorEntry(value: unknown): ActorEntry | null {
  if (
    !isObject(value) ||
    typeof value.name !== "string" ||
    typeof value.movieCount !== "number" ||
    !Number.isInteger(value.movieCount)
  ) {
    return null;
  }

  const movies = parseActorMovies(value.movies);

  return movies === null
    ? null
    : { name: value.name, movieCount: value.movieCount, movies };
}

function parseActors(payload: unknown): ActorEntry[] | null {
  if (!isObject(payload) || !Array.isArray(payload.actors)) {
    return null;
  }

  const actors: ActorEntry[] = [];

  for (const entry of payload.actors) {
    const actor = parseActorEntry(entry);

    if (actor === null) {
      return null;
    }

    actors.push(actor);
  }

  return actors;
}

function parseSearchResults(payload: unknown): SearchResults | null {
  if (!isObject(payload)) {
    return null;
  }

  const results = parseItems(payload.results);

  if (!results || typeof payload.hasMore !== "boolean") {
    return null;
  }

  const type = payload.type;

  if (type !== "movie" && type !== "series" && type !== "all") {
    return null;
  }

  return { results, hasMore: payload.hasMore, type };
}

async function request<T>(
  endpoint: string,
  options: RequestInit,
  parse: (payload: unknown) => T | null,
): Promise<ApiResult<T>> {
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

    if (response.status === 404) {
      return failure("not-found");
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

export function apiGetCollection(
  collection: Collection,
  signal?: AbortSignal,
): Promise<ApiResult<MediaItem[]>> {
  return request(
    `/api/cinemeta/catalog/${collection}`,
    { signal },
    parseMediaItemList,
  );
}

/** Lista de la vista Películas: una petición por pestaña. */
export function apiGetMovieList(
  list: MovieList,
  signal?: AbortSignal,
): Promise<ApiResult<MediaItem[]>> {
  return request(
    `/api/cinemeta/movies/${list}`,
    { signal },
    parseMediaItemList,
  );
}

/** Lista de la vista Series: una petición por pestaña. */
export function apiGetSeriesList(
  list: SeriesList,
  signal?: AbortSignal,
): Promise<ApiResult<MediaItem[]>> {
  return request(
    `/api/cinemeta/series/${list}`,
    { signal },
    parseMediaItemList,
  );
}

/** Actores de todas las películas: una sola petición para la vista. */
export function apiGetActors(
  signal?: AbortSignal,
): Promise<ApiResult<ActorEntry[]>> {
  return request(`/api/cinemeta/actors`, { signal }, parseActors);
}

function parseActorDetail(payload: unknown): ActorDetail | null {
  if (!isObject(payload) || !isObject(payload.actor)) {
    return null;
  }

  const actor = parseActorEntry(payload.actor);

  if (actor === null) {
    return null;
  }

  const imageUrl = payload.actor.imageUrl;
  const biography = payload.actor.biography;

  return {
    ...actor,
    ...(typeof imageUrl === "string" && imageUrl ? { imageUrl } : {}),
    ...(typeof biography === "string" && biography ? { biography } : {}),
  };
}

/** Datos de un actor (foto y biografía de TMDB): una petición por actor. */
export function apiGetActor(
  name: string,
  signal?: AbortSignal,
): Promise<ApiResult<ActorDetail>> {
  const params = new URLSearchParams({ name: name.trim() });

  return request(
    `/api/cinemeta/actor?${params.toString()}`,
    { signal },
    parseActorDetail,
  );
}

export function apiSearch(
  query: string,
  type: SearchType,
  signal?: AbortSignal,
  limit?: number,
): Promise<ApiResult<SearchResults>> {
  const params = new URLSearchParams({
    q: query.trim(),
    type,
  });

  // Sin limit el backend usa su tope por defecto (10, el del panel).
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }

  return request(
    `/api/cinemeta/search?${params.toString()}`,
    { signal },
    parseSearchResults,
  );
}

function parseTitleDetail(payload: unknown): TitleDetail | null {
  if (!isObject(payload)) {
    return null;
  }

  const type = payload.type;

  if (typeof payload.id !== "string" || typeof payload.name !== "string") {
    return null;
  }

  if (type !== "movie" && type !== "series") {
    return null;
  }

  // Opcionales: ausentes o null no estorban; con otro tipo, la forma no sirve.
  for (const field of [
    "poster",
    "description",
    "year",
    "runtime",
    "imdbRating",
    "trailerSource",
  ]) {
    const value = payload[field];

    if (value !== undefined && value !== null && typeof value !== "string") {
      return null;
    }
  }

  for (const field of ["genres", "director", "cast"]) {
    const value = payload[field];

    if (value !== undefined && value !== null && !isStringArray(value)) {
      return null;
    }
  }

  return {
    id: payload.id,
    type,
    name: payload.name,
    ...(typeof payload.poster === "string" ? { poster: payload.poster } : {}),
    ...(typeof payload.description === "string"
      ? { description: payload.description }
      : {}),
    ...(typeof payload.year === "string" ? { year: payload.year } : {}),
    ...(typeof payload.runtime === "string" ? { runtime: payload.runtime } : {}),
    ...(typeof payload.imdbRating === "string"
      ? { imdbRating: payload.imdbRating }
      : {}),
    ...(isStringArray(payload.genres) ? { genres: payload.genres } : {}),
    ...(isStringArray(payload.director) ? { director: payload.director } : {}),
    ...(isStringArray(payload.cast) ? { cast: payload.cast } : {}),
    ...(typeof payload.trailerSource === "string"
      ? { trailerSource: payload.trailerSource }
      : {}),
  };
}

export function apiGetTitle(
  type: MediaType,
  id: string,
  signal?: AbortSignal,
): Promise<ApiResult<TitleDetail>> {
  return request(
    `/api/cinemeta/${type}/${encodeURIComponent(id)}`,
    { signal },
    parseTitleDetail,
  );
}