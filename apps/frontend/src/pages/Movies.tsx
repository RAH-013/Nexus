import type { ReactNode } from "react";
import type { MovieList } from "../api/cinemeta";
import SectionError from "../components/home/SectionError";
import MovieCard from "../components/movies/MovieCard";
import { useMovieList } from "../hooks/useMovieList";
import { useMovies } from "../hooks/useMovies";
import { useViews } from "../hooks/useViews";
import { filterByGenre, filterByViewed, sortMovies } from "../utils/movieList";

/** Orden de pestañas de izquierda a derecha, como en la maqueta (§1.2). */
const TABS: { list: MovieList; label: string }[] = [
  { list: "trending", label: "Populares" },
  { list: "playing", label: "En cartelera" },
  { list: "upcoming", label: "Próximos" },
  { list: "rated", label: "Mejor calificados" },
];

function GridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
      aria-hidden="true"
    >
      {Array.from({ length: 12 }, (_, position) => (
        <div
          key={position}
          className="aspect-2/3 animate-pulse rounded-lg bg-slate-800 [@media(prefers-reduced-motion:reduce)]:animate-none"
        />
      ))}
    </div>
  );
}

/** Vacío de lista y vacío de filtro con mensajes distintos (RF-4, RF-7). */
function EmptyBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex min-h-40 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-10 text-center text-sm text-slate-300"
    >
      {children}
    </div>
  );
}

/**
 * Vista Películas (spec 003): cuatro pestañas con una lista cada una en
 * cuadrícula, Ordenar y Filtros compartidos con el sidebar y estados
 * independientes por lista (RF-3, RF-4).
 */
function Movies() {
  const { list, setList, sort, genre, show } = useMovies();
  const { viewedIds } = useViews();
  const { items, status, retry } = useMovieList(list);

  // Ordenar y Filtros actúan sobre la lista de la pestaña activa ya cargada
  // (RF-6…RF-8): no se vuelve a pedir nada a Cinemeta por filtrar u ordenar.
  const visible = sortMovies(
    filterByViewed(filterByGenre(items, genre), show, viewedIds),
    sort,
  );

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Listas de películas"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((tab) => (
          <button
            key={tab.list}
            type="button"
            role="tab"
            id={`movies-tab-${tab.list}`}
            aria-selected={list === tab.list}
            aria-controls="movies-grid"
            onClick={() => setList(tab.list)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
              list === tab.list
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        id="movies-grid"
        role="tabpanel"
        aria-labelledby={`movies-tab-${list}`}
        className="space-y-4"
      >
        {status === "loading" && <GridSkeleton />}
        {status === "error" && <SectionError onRetry={retry} />}
        {status === "rate-limit" && <SectionError variant="limit" />}
        {status === "empty" && <EmptyBox>No hay películas en esta lista</EmptyBox>}

        {status === "ready" && visible.length === 0 && (
          <EmptyBox>Ninguna película coincide con los filtros</EmptyBox>
        )}

        {status === "ready" && visible.length > 0 && (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {visible.map((item, position) => (
              <li key={`${item.id}-${position}`} className="min-w-0">
                <MovieCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Movies;