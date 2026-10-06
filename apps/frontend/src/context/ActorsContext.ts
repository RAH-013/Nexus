import { createContext } from "react";
import type { ActorsSort } from "../utils/actorsList";

/**
 * Estado compartido entre `ActorsSidebar` y la cuadrícula mientras el usuario
 * no salga de `/actors`.
 */
export interface ActorsContextType {
  sort: ActorsSort;
  setSort: (sort: ActorsSort) => void;
  /** Texto de la búsqueda de actores; vacío = sin filtro. */
  query: string;
  setQuery: (query: string) => void;
}

export const ActorsContext = createContext<ActorsContextType | null>(null);
