import { env } from "../config/env";
import { normalizeQuery } from "./cinemeta";

const TMDB_BASE_URL = env.TMDB_BASE_URL;
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

/** Personas: foto y biografía apenas cambian, se guardan 24 h. */
const PERSON_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** TMDB permite 40 peticiones cada 10 s: se comparten entre todas las llamadas. */
const MAX_CONCURRENT_REQUESTS = 3;

/** Persona de TMDB con los datos que muestra la vista Actores. */
export interface TmdbPerson {
  id: number;
  name: string;
  profilePath?: string;
  biography?: string;
}

interface TmdbSearchResult {
  id: number;
  name: string;
  profile_path?: string;
}

interface TmdbSearchResponse {
  results?: TmdbSearchResult[];
}

interface TmdbPersonResponse {
  biography?: string;
}

interface CachedPerson {
  person: TmdbPerson | null;
  expiresAt: number;
}

/** URL de foto de perfil en el CDN de TMDB: la carga el navegador. */
export function profileImageUrl(profilePath: string): string {
  // `profile_path` viene con barra inicial («/kUjW4d.jpg»).
  return `${TMDB_IMAGE_BASE_URL}/w185/${profilePath.replace(/^\/+/, "")}`;
}

let missingKeyWarned = false;

class TmdbService {
  /** Clave vacía = integración desactivada: `findPerson` responde `null`. */
  private readonly apiKey = env.TMDB_API_KEY ?? "";

  /** Caché de personas por nombre normalizado: guarda aciertos y «no hay». */
  private cache = new Map<string, CachedPerson>();

  /** Peticiones en vuelo por nombre: un solo viaje por actor. */
  private inFlight = new Map<string, Promise<TmdbPerson | null>>();

  private activeRequests = 0;
  private waiting: (() => void)[] = [];

  /**
   * Persona de TMDB por nombre: búsqueda con fallback al primer resultado
   * (Cinemeta solo entrega nombres, no ids de persona) + detalle para la
   * biografía. Sin clave de API o sin resultado → `null`; los errores de
   * red no se guardan (el reintento vuelve a pedir a TMDB).
   */
  async findPerson(name: string): Promise<TmdbPerson | null> {
    if (!this.apiKey) {
      if (!missingKeyWarned) {
        missingKeyWarned = true;
        console.warn(
          "TMDB_API_KEY no configurada: los actores se mostrarán sin foto ni biografía",
        );
      }

      return null;
    }

    const key = normalizeQuery(name);

    if (!key) {
      return null;
    }

    const cached = this.cache.get(key);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.person;
    }

    const pending = this.inFlight.get(key);

    if (pending) {
      return pending;
    }

    const promise = this.fetchPerson(key, name).finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);

    return promise;
  }

  /** Busca la persona y trae su biografía; guarda el resultado (o su ausencia). */
  private async fetchPerson(
    key: string,
    name: string,
  ): Promise<TmdbPerson | null> {
    const person = await this.withSlot<TmdbPerson | null>(async () => {
      const response = await this.request<TmdbSearchResponse>(
        "/search/person",
        {
          query: name,
          include_adult: "false",
          language: "es-ES",
        },
      );

      const results = response.results ?? [];
      // Nombre exacto primero; de no haberlo, el candidato mejor posicionado.
      const match =
        results.find((result) => normalizeQuery(result.name) === key) ??
        results[0];

      if (!match) {
        return null;
      }

      const detail = await this.request<TmdbPersonResponse>(
        `/person/${match.id}`,
        { language: "es-ES" },
      );

      return {
        id: match.id,
        name: match.name,
        ...(match.profile_path ? { profilePath: match.profile_path } : {}),
        ...(detail.biography ? { biography: detail.biography } : {}),
      };
    });

    this.cache.set(key, {
      person,
      expiresAt: Date.now() + PERSON_CACHE_TTL_MS,
    });

    return person;
  }

  /**
   * Hasta `MAX_CONCURRENT_REQUESTS` peticiones a la vez; el resto espera
   * su turno para no superar el límite de TMDB.
   */
  private async withSlot<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= MAX_CONCURRENT_REQUESTS) {
      await new Promise<void>((resolve) => {
        this.waiting.push(resolve);
      });
    }

    this.activeRequests += 1;

    try {
      return await task();
    } finally {
      this.activeRequests -= 1;
      this.waiting.shift()?.();
    }
  }

  private async request<T>(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set("api_key", this.apiKey);

    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Tmdb request failed: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }
}

export const tmdbService = new TmdbService();
