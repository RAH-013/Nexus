import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { ActorsContext } from "../context/ActorsContext";
import type { ActorsSort } from "../utils/actorsList";

interface ActorsProviderProps {
  children?: ReactNode;
}

/**
 * Estado de la vista Actores: vive sobre el layout de `/actors` para que
 * `ActorsSidebar` y la cuadrícula compartan Ordenar por y Buscar.
 * Al salir de la ruta el provider se desmonta y restablece los valores.
 */
export function ActorsProvider({ children }: ActorsProviderProps) {
  const [sort, setSort] = useState<ActorsSort>("count");
  const [query, setQuery] = useState("");

  return (
    <ActorsContext.Provider value={{ sort, setSort, query, setQuery }}>
      {children ?? <Outlet />}
    </ActorsContext.Provider>
  );
}
