import { createContext } from "react";
import type { MovieList } from "../api/cinemeta";
import type { MovieShow, MovieSort } from "../utils/movieList";

/**
 * Estado compartido entre `MoviesSidebar` y la cuadrícula mientras el usuario
 * no salga de `/movies` (spec 003, RF-3 y D8).
 */
export interface MoviesContextType {
  /** Pestaña activa: Populares por defecto (RF-1). */
  list: MovieList;
  setList: (list: MovieList) => void;
  sort: MovieSort;
  setSort: (sort: MovieSort) => void;
  /** Género Cinemeta en inglés; `null` = sin filtro (RF-7). */
  genre: string | null;
  setGenre: (genre: string | null) => void;
  show: MovieShow;
  setShow: (show: MovieShow) => void;
}

export const MoviesContext = createContext<MoviesContextType | null>(null);