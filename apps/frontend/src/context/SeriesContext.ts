import { createContext } from "react";
import type { SeriesList } from "../api/cinemeta";
import type { SeriesShow, SeriesSort } from "../utils/seriesList";

/**
 * Estado compartido entre `SeriesSidebar` y la cuadrícula mientras el usuario
 * no salga de `/series`.
 */
export interface SeriesContextType {
  /** Pestaña activa: Populares por defecto. */
  list: SeriesList;
  setList: (list: SeriesList) => void;
  sort: SeriesSort;
  setSort: (sort: SeriesSort) => void;
  /** Género Cinemeta en inglés; `null` = sin filtro. */
  genre: string | null;
  setGenre: (genre: string | null) => void;
  show: SeriesShow;
  setShow: (show: SeriesShow) => void;
}

export const SeriesContext = createContext<SeriesContextType | null>(null);