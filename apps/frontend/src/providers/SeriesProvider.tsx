import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import type { SeriesList } from "../api/cinemeta";
import { SeriesContext } from "../context/SeriesContext";
import type { SeriesShow, SeriesSort } from "../utils/seriesList";

interface SeriesProviderProps {
  children?: ReactNode;
}

/**
 * Estado de la vista Series: vive sobre el layout de `/series` para que
 * `SeriesSidebar` y la cuadrícula compartan pestaña, Ordenar y Filtros.
 * Al salir de la ruta el provider se desmonta y restablece los filtros.
 */
export function SeriesProvider({ children }: SeriesProviderProps) {
  const [list, setList] = useState<SeriesList>("trending");
  const [sort, setSort] = useState<SeriesSort>("source");
  const [genre, setGenre] = useState<string | null>(null);
  const [show, setShow] = useState<SeriesShow>("all");

  return (
    <SeriesContext.Provider
      value={{ list, setList, sort, setSort, genre, setGenre, show, setShow }}
    >
      {children ?? <Outlet />}
    </SeriesContext.Provider>
  );
}