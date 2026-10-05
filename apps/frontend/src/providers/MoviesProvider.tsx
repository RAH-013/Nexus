import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import type { MovieList } from "../api/cinemeta";
import { MoviesContext } from "../context/MoviesContext";
import type { MovieShow, MovieSort } from "../utils/movieList";

interface MoviesProviderProps {
  children?: ReactNode;
}

/**
 * Estado de la vista Películas (spec 003, D8): vive sobre el layout de
 * `/movies` para que `MoviesSidebar` y la cuadrícula compartan pestaña,
 * Ordenar y Filtros. Al salir de la ruta el provider se desmonta y no hay
 * obligación de recordar nada (sin URL de filtros).
 */
export function MoviesProvider({ children }: MoviesProviderProps) {
  const [list, setList] = useState<MovieList>("trending");
  const [sort, setSort] = useState<MovieSort>("source");
  const [genre, setGenre] = useState<string | null>(null);
  const [show, setShow] = useState<MovieShow>("all");

  return (
    <MoviesContext.Provider
      value={{ list, setList, sort, setSort, genre, setGenre, show, setShow }}
    >
      {children ?? <Outlet />}
    </MoviesContext.Provider>
  );
}