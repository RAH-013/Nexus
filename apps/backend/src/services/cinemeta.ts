const CINEMETA_BASE_URL = "https://v3-cinemeta.strem.io";

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
}

interface CinemetaResponse<T> {
  metas?: T[];
  meta?: T;
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

  async search(
    type: "movie" | "series",
    query: string,
  ): Promise<CinemetaCatalogItem[]> {
    const encodedQuery = encodeURIComponent(query.trim());

    const response = await this.request<CinemetaResponse<CinemetaCatalogItem>>(
      `/catalog/${type}/top/search=${encodedQuery}.json`,
    );

    return response.metas ?? [];
  }

  async getMovie(id: string): Promise<CinemetaMeta> {
    const response = await this.request<CinemetaResponse<CinemetaMeta>>(
      `/meta/movie/${encodeURIComponent(id)}.json`,
    );

    if (!response.meta) {
      throw new Error("Película no encontrada");
    }

    return response.meta;
  }

  async getSeries(id: string): Promise<CinemetaMeta> {
    const response = await this.request<CinemetaResponse<CinemetaMeta>>(
      `/meta/series/${encodeURIComponent(id)}.json`,
    );

    if (!response.meta) {
      throw new Error("Serie no encontrada");
    }

    return response.meta;
  }
}

export const cinemetaService = new CinemetaService();
