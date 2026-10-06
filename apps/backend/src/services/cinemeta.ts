import { env } from "../config/env";

const CINEMETA_BASE_URL = env.CINEMETA_BASE_URL;

const FEATURED_LIMIT = 10;
const SEARCH_LIMIT = 10;

/** La agregación de actores se guarda 15 min: son varias llamadas a Cinemeta. */
const ACTORS_CACHE_TTL_MS = 15 * 60 * 1000;

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
  /** Reparto (top ~3 por título): lo usa la vista Actores. */
  cast?: string[];
}

export interface CinemetaMeta extends CinemetaCatalogItem {
  year?: number;
  runtime?: string;
  director?: string[];
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
  /** Géneros de la fuente: los pide la vista Películas/Series para filtrar. */
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

/** Película referenciada por la card de un actor. */
export interface ActorMovieRef {
  id: string;
  name: string;
  poster?: string;
}

/** Actor agregado del reparto de todas las películas (vista Actores). */
export interface ActorEntry {
  name: string;
  movieCount: number;
  movies: ActorMovieRef[];
}

interface CinemetaResponse<T> {
  metas?: T[];
  meta?: T;
}

export function isCollection(value: string): value is Collection {
  return (COLLECTIONS as readonly string[]).includes(value);
}

export const CATALOG_LISTS = ["trending", "playing", "upcoming", "rated"] as const;

export type CatalogList = (typeof CATALOG_LISTS)[number];

/** Alias por retrocompatibilidad con Películas */
export const MOVIE_LISTS = CATALOG_LISTS;
export type MovieList = CatalogList;

export function isCatalogList(value: string): value is CatalogList {
  return (CATALOG_LISTS as readonly string[]).includes(value);
}

export function isMovieList(value: string): value is MovieList {
  return isCatalogList(value);
}

export function isSeriesList(value: string): value is CatalogList {
  return isCatalogList(value);
}

/**
 * Años civiles de las pestañas «En cartelera/emisión» y «Próximos»: se calculan con el
 * reloj del servidor para que un cambio de año no rompa la vista.
 */
export function calendarYears(now: Date = new Date()): { current: number; next: number } {
  const current = now.getFullYear();

  return { current, next: current + 1 };
}

/**
 * Endpoint del catálogo de cada pestaña según el tipo ('movie' o 'series').
 */
export function catalogListEndpoint(
  type: "movie" | "series",
  list: CatalogList,
  now: Date = new Date(),
): string {
  const { current, next } = calendarYears(now);

  switch (list) {
    case "playing":
      return `/catalog/${type}/year/genre=${current}.json`;
    case "upcoming":
      return `/catalog/${type}/year/genre=${next}.json`;
    case "rated":
      return `/catalog/${type}/imdbRating.json`;
    case "trending":
      return `/catalog/${type}/trending.json`;
  }
}

export function movieListEndpoint(list: MovieList, now: Date = new Date()): string {
  return catalogListEndpoint("movie", list, now);
}

export function seriesListEndpoint(list: CatalogList, now: Date = new Date()): string {
  return catalogListEndpoint("series", list, now);
}

/**
 * Catálogos de película que alimentan la vista Actores: los que son distintos
 * entre sí (en Cinemeta los catálogos «populares» devuelven el mismo top 100).
 * Los de año son opcionales: si fallan aportan 0 pelis, como el «upcoming»
 * de `getCatalogList`.
 */
export function actorSourceEndpoints(
  now: Date = new Date(),
): { endpoint: string; optional: boolean }[] {
  return [
    { endpoint: catalogListEndpoint("movie", "trending", now), optional: false },
    { endpoint: catalogListEndpoint("movie", "rated", now), optional: false },
    { endpoint: "/catalog/movie/top.json", optional: false },
    { endpoint: catalogListEndpoint("movie", "playing", now), optional: true },
    { endpoint: catalogListEndpoint("movie", "upcoming", now), optional: true },
  ];
}

export function isSearchType(value: string): value is SearchType {
  return (SEARCH_TYPES as readonly string[]).includes(value);
}

/** Mayúsculas, acentos y espacios sobrantes fuera. */
export function normalizeQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Primer año de «2008-2013» → «2008»; sin año reconocible → nada. */
export function extractYear(releaseInfo?: string): string | undefined {
  if (!releaseInfo) {
    return undefined;
  }

  return releaseInfo.trim().match(/^(\d{4})/)?.[1];
}

/** Mezcla dos listas alternándolas y conservando el orden relativo de cada una. */
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

/** Filtro de género en inglés, sin deduplicar. */
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
 * Normaliza la meta de Cinemeta a la ficha: un solo repaso de campos.
 * Sin `name` no hay ficha que mostrar → `null`.
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
  /** Caché de actores: promesa en vuelo + resultado con TTL (15 min). */
  private actorsPromise: Promise<ActorEntry[]> | null = null;
  private actorsCache: { actors: ActorEntry[]; expiresAt: number } | null = null;

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
   * Método genérico para consultar catálogos ('movie' o 'series').
   */
  async getCatalogList(type: "movie" | "series", list: CatalogList): Promise<CatalogItem[]> {
    try {
      const response = await this.request<CinemetaResponse<CinemetaCatalogItem>>(
        catalogListEndpoint(type, list),
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

  /** Lista movie de una pestaña (conservado por compatibilidad). */
  async getMovieList(list: MovieList): Promise<CatalogItem[]> {
    return this.getCatalogList("movie", list);
  }

  /** Lista series de una pestaña. */
  async getSeriesList(list: CatalogList): Promise<CatalogItem[]> {
    return this.getCatalogList("series", list);
  }

  /**
   * Actores de todas las películas: unión del `cast` (top ~3 por peli) de los
   * catálogos de `actorSourceEndpoints`, con películas deduplicadas por id.
   * Caché en memoria con TTL; los fallos no se guardan (el reintento vuelve a
   * pedir a Cinemeta).
   */
  async getActors(now: Date = new Date()): Promise<ActorEntry[]> {
    if (this.actorsCache && now.getTime() < this.actorsCache.expiresAt) {
      return this.actorsCache.actors;
    }

    if (!this.actorsPromise) {
      const promise = this.fetchActors(now).then(
        (actors) => {
          this.actorsCache = {
            actors,
            expiresAt: Date.now() + ACTORS_CACHE_TTL_MS,
          };
          this.actorsPromise = null;
          return actors;
        },
        (error: unknown) => {
          this.actorsPromise = null;
          throw error;
        },
      );

      this.actorsPromise = promise;
    }

    return this.actorsPromise;
  }

  /** Trae los catálogos fuente en paralelo y arma el mapa actor → películas. */
  private async fetchActors(now: Date): Promise<ActorEntry[]> {
    const catalogs = await Promise.all(
      actorSourceEndpoints(now).map(async ({ endpoint, optional }) => {
        try {
          const response = await this.request<CinemetaResponse<CinemetaCatalogItem>>(
            endpoint,
          );

          return response.metas ?? [];
        } catch (error) {
          if (optional) {
            return [];
          }

          throw error;
        }
      }),
    );

    // Películas deduplicadas por id: varios catálogos comparten títulos.
    const movies = new Map<string, CinemetaCatalogItem>();

    for (const metas of catalogs) {
      for (const meta of metas) {
        if (meta.name && !movies.has(meta.id)) {
          movies.set(meta.id, meta);
        }
      }
    }

    const byActor = new Map<string, ActorMovieRef[]>();

    for (const movie of movies.values()) {
      for (const cast of movie.cast ?? []) {
        const name = cast.trim();

        if (!name) {
          continue;
        }

        const list = byActor.get(name) ?? [];
        list.push({
          id: movie.id,
          name: movie.name,
          ...(movie.poster ? { poster: movie.poster } : {}),
        });
        byActor.set(name, list);
      }
    }

    const actors: ActorEntry[] = [...byActor.entries()].map(([name, list]) => ({
      name,
      movieCount: list.length,
      movies: list,
    }));

    // Más películas primero; de empate, alfabético.
    actors.sort(
      (a, b) => b.movieCount - a.movieCount || a.name.localeCompare(b.name, "es"),
    );

    return actors;
  }

  /**
   * Actor de la agregación por nombre exacto (normalizado): la ficha de
   * TMDB solo se pide para actores que Cinemeta ya entrega.
   */
  async findActorByName(name: string): Promise<ActorEntry | null> {
    const target = normalizeQuery(name);

    if (!target) {
      return null;
    }

    const actors = await this.getActors();

    return (
      actors.find((actor) => normalizeQuery(actor.name) === target) ?? null
    );
  }

  /** `limit` opcional (1..50): el panel pide 10 y la vista de resultados, más. */
  async search(
    type: SearchType,
    query: string,
    limit: number = SEARCH_LIMIT,
  ): Promise<SearchResult> {
    const normalizedQuery = normalizeQuery(query);
    const types: ("movie" | "series")[] =
      type === "all" ? ["movie", "series"] : [type];

    const lists = await Promise.all(
      types.map((searchType) => this.searchInSource(searchType, normalizedQuery)),
    );
    const [movies, series = []] = lists;

    return {
      ...limitResults(alternateTypes(movies, series).map(toCatalogItem), limit),
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