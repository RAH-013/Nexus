import { env } from "../config/env";

const CINEMETA_BASE_URL = env.CINEMETA_BASE_URL;

const FEATURED_LIMIT = 10;
const SEARCH_LIMIT = 10;

export const COLLECTIONS = [
  "featured",
  "trending",
  "action",
  "drama",
  "adventure",
  "thriller",
  "comedy",
  "horror",
] as const;

export type Collection = (typeof COLLECTIONS)[number];

const COLLECTION_GENRE: Partial<Record<Collection, string>> = {
  action: "Action",
  drama: "Drama",
  adventure: "Adventure",
  thriller: "Thriller",
  comedy: "Comedy",
  horror: "Horror",
};

const SEARCH_TYPES = ["movie", "series", "all"] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

export interface CinemetaCatalogItem {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  genres?: string[];
}

export interface CinemetaMeta extends CinemetaCatalogItem {
  year?: number;
  runtime?: string;
  director?: string[];
  cast?: string[];
  background?: string;
  trailers?: { source?: string }[];
  /** Entregados por la fuente y descartados por la ficha (spec 002 §1.1). */
  links?: unknown[];
  popularity?: number;
}

/**
 * Meta de la ficha tal como llega de la fuente: los ids inexistentes
 * (p. ej. `tt0000000`) vienen sin `name`, y eso decide el 404 (RF-7).
 */
export type CinemetaRawMeta = Omit<CinemetaMeta, "name"> & { name?: string };

export interface CatalogItem {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  year?: string;
  /** Géneros de la fuente: los pide la vista Películas para filtrar (spec 003, RF-7). */
  genres?: string[];
}

export interface SearchResult {
  results: CatalogItem[];
  hasMore: boolean;
  type: SearchType;
}

/** Forma exacta que consume la ficha (spec 002 §1.1: solo campos propios). */
export interface TitleDetail {
  id: string;
  type: "movie" | "series";
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

interface CinemetaResponse<T> {
  metas?: T[];
  meta?: T;
}

export function isCollection(value: string): value is Collection {
  return (COLLECTIONS as readonly string[]).includes(value);
}

export const MOVIE_LISTS = ["trending", "playing", "upcoming", "rated"] as const;

export type MovieList = (typeof MOVIE_LISTS)[number];

export function isMovieList(value: string): value is MovieList {
  return (MOVIE_LISTS as readonly string[]).includes(value);
}

/**
 * Años civiles de las pestañas «En cartelera» y «Próximos»: se calculan con el
 * reloj del servidor para que un cambio de año no rompa la vista (spec 003, caso 3).
 */
export function calendarYears(now: Date = new Date()): { current: number; next: number } {
  const current = now.getFullYear();

  return { current, next: current + 1 };
}

/**
 * Catálogo movie de cada pestaña (spec 003 §1.2). En `year` el extra `genre`
 * es el **año**, no un género: por eso el filtro de género se aplica en cliente.
 */
export function movieListEndpoint(list: MovieList, now: Date = new Date()): string {
  const { current, next } = calendarYears(now);

  switch (list) {
    case "playing":
      return `/catalog/movie/year/genre=${current}.json`;
    case "upcoming":
      return `/catalog/movie/year/genre=${next}.json`;
    case "rated":
      return "/catalog/movie/imdbRating.json";
    case "trending":
      return "/catalog/movie/trending.json";
  }
}

export function isSearchType(value: string): value is SearchType {
  return (SEARCH_TYPES as readonly string[]).includes(value);
}

/** Mayúsculas, acentos y espacios sobrantes fuera (RF-7). */
export function normalizeQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Primer año de «2008-2013» → «2008»; sin año reconocible → nada (RF-7). */
export function extractYear(releaseInfo?: string): string | undefined {
  if (!releaseInfo) {
    return undefined;
  }

  return releaseInfo.trim().match(/^(\d{4})/)?.[1];
}

/** Mezcla dos listas alternándolas y conservando el orden relativo de cada una (RF-1, RF-4, RF-5). */
export function alternateTypes<T>(first: readonly T[], second: readonly T[]): T[] {
  const mixed: T[] = [];
  const length = Math.max(first.length, second.length);

  for (let index = 0; index < length; index += 1) {
    if (index < first.length) {
      mixed.push(first[index]);
    }

    if (index < second.length) {
      mixed.push(second[index]);
    }
  }

  return mixed;
}

/** Filtro de género en inglés, sin deduplicar (RF-5). */
export function filterByGenre(
  items: readonly CinemetaCatalogItem[],
  genre: string,
): CinemetaCatalogItem[] {
  const target = genre.toLowerCase();

  return items.filter((item) =>
    item.genres?.some((itemGenre) => itemGenre.toLowerCase() === target),
  );
}

export function toCatalogItem(item: CinemetaCatalogItem): CatalogItem {
  const year = extractYear(item.releaseInfo);

  return {
    id: item.id,
    type: item.type,
    name: item.name,
    ...(item.poster ? { poster: item.poster } : {}),
    ...(year ? { year } : {}),
    ...(item.genres ? { genres: item.genres } : {}),
  };
}

/**
 * Normaliza la meta de Cinemeta a la ficha: un solo repaso de campos
 * (RF-3…RF-6). Sin `name` no hay ficha que mostrar → `null` (RF-7).
 */
export function toTitleDetail(meta?: CinemetaRawMeta): TitleDetail | null {
  if (!meta?.name) {
    return null;
  }

  const year = extractYear(meta.releaseInfo);
  const trailerSource = meta.trailers?.find((trailer) => trailer.source)?.source;

  return {
    id: meta.id,
    type: meta.type,
    name: meta.name,
    ...(meta.poster ? { poster: meta.poster } : {}),
    ...(meta.description ? { description: meta.description } : {}),
    ...(year ? { year } : {}),
    ...(meta.runtime ? { runtime: meta.runtime } : {}),
    ...(meta.imdbRating ? { imdbRating: meta.imdbRating } : {}),
    ...(meta.genres ? { genres: meta.genres } : {}),
    ...(meta.director ? { director: meta.director } : {}),
    ...(meta.cast ? { cast: meta.cast } : {}),
    ...(trailerSource ? { trailerSource } : {}),
  };
}

export function limitResults(
  items: readonly CatalogItem[],
  limit: number = SEARCH_LIMIT,
): { results: CatalogItem[]; hasMore: boolean } {
  return {
    results: items.slice(0, limit),
    hasMore: items.length > limit,
  };
}

class CinemetaService {
  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${CINEMETA_BASE_URL}${endpoint}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Cinemeta request failed: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private async getCatalog(
    type: "movie" | "series",
    kind: "top" | "trending",
  ): Promise<CinemetaCatalogItem[]> {
    const response = await this.request<CinemetaResponse<CinemetaCatalogItem>>(
      `/catalog/${type}/${kind}.json`,
    );

    return response.metas ?? [];
  }

  private async searchInSource(
    type: "movie" | "series",
    query: string,
  ): Promise<CinemetaCatalogItem[]> {
    const encodedQuery = encodeURIComponent(query);

    const response = await this.request<CinemetaResponse<CinemetaCatalogItem>>(
      `/catalog/${type}/top/search=${encodedQuery}.json`,
    );

    return response.metas ?? [];
  }

  async getCollection(collection: Collection): Promise<CatalogItem[]> {
    if (collection === "featured") {
      const [movies, series] = await Promise.all([
        this.getCatalog("movie", "top"),
        this.getCatalog("series", "top"),
      ]);

      return alternateTypes(movies, series)
        .slice(0, FEATURED_LIMIT)
        .map(toCatalogItem);
    }

    const genre = COLLECTION_GENRE[collection];
    const [movies, series] = await Promise.all([
      this.getCatalog("movie", "trending"),
      this.getCatalog("series", "trending"),
    ]);

    const filteredMovies = genre ? filterByGenre(movies, genre) : movies;
    const filteredSeries = genre ? filterByGenre(series, genre) : series;

    return alternateTypes(filteredMovies, filteredSeries).map(toCatalogItem);
  }

  /**
   * Lista movie de una pestaña (spec 003, D2): una petición al catálogo, sin
   * `skip`. `upcoming` con la fuente !ok (el año siguiente aún no está
   * publicado) devuelve lista vacía en vez de 502 (RF-4); un fallo de red o
   * una respuesta ilegible siguen siendo error.
   */
  async getMovieList(list: MovieList): Promise<CatalogItem[]> {
    try {
      const response = await this.request<CinemetaResponse<CinemetaCatalogItem>>(
        movieListEndpoint(list),
      );

      return (response.metas ?? []).map(toCatalogItem);
    } catch (error) {
      if (
        list === "upcoming" &&
        error instanceof Error &&
        error.message.startsWith("Cinemeta request failed")
      ) {
        return [];
      }

      throw error;
    }
  }

  async search(type: SearchType, query: string): Promise<SearchResult> {
    const normalizedQuery = normalizeQuery(query);
    const types: ("movie" | "series")[] =
      type === "all" ? ["movie", "series"] : [type];

    const lists = await Promise.all(
      types.map((searchType) => this.searchInSource(searchType, normalizedQuery)),
    );
    const [movies, series = []] = lists;

    return {
      ...limitResults(alternateTypes(movies, series).map(toCatalogItem)),
      type,
    };
  }

  async getTitle(type: "movie" | "series", id: string): Promise<TitleDetail | null> {
    const response = await this.request<CinemetaResponse<CinemetaRawMeta>>(
      `/meta/${type}/${encodeURIComponent(id)}.json`,
    );

    return toTitleDetail(response.meta);
  }
}

export const cinemetaService = new CinemetaService();
