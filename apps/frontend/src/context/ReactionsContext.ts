import { createContext } from "react";
import type { MediaType } from "../api/cinemeta";

/**
 * Reacciones de la ficha (spec 004, RF-1): la fuente de verdad es
 * PostgreSQL vía `/api/reactions`. Sin sesión los conjuntos están vacíos y
 * `enabled` oculta los botones (mismo criterio que `ViewsContext`).
 */
export interface ReactionsContextType {
  isFavorite: (id: string) => boolean;
  isLiked: (id: string) => boolean;
  isDisliked: (id: string) => boolean;
  /** true mientras ese título tiene una petición en vuelo (todas las claves). */
  isPending: (id: string) => boolean;
  /** Favorito: independiente de like/dislike (RF-3). */
  toggleFavorite: (type: MediaType, id: string) => Promise<void>;
  /** Me gusta: al activarlo se quita el «no me gusta» (exclusión mutua). */
  toggleLike: (type: MediaType, id: string) => Promise<void>;
  /** No me gusta: al activarlo se quita el «me gusta» (exclusión mutua). */
  toggleDislike: (type: MediaType, id: string) => Promise<void>;
  /** Solo con sesión existen los botones (RF-1). */
  enabled: boolean;
}

export const ReactionsContext = createContext<ReactionsContextType | null>(null);
