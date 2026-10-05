import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MenuIcon, XIcon } from "lucide-animated";
import { useMovies } from "../../hooks/useMovies";
import { useViews } from "../../hooks/useViews";
import { MOVIE_GENRES, translateGenre } from "../../utils/genres";
import type { MovieShow, MovieSort } from "../../utils/movieList";

const SORT_OPTIONS: { value: MovieSort; label: string }[] = [
  { value: "source", label: "Orden de la fuente" },
  { value: "date", label: "Fecha" },
  { value: "name", label: "Alfabético" },
];

/** Solo con sesión: sin usuario no existe el bloque Mostrar (RF-8). */
const SHOW_OPTIONS: { value: MovieShow; label: string }[] = [
  { value: "all", label: "Todo" },
  { value: "unwatched", label: "Películas que no he visto" },
  { value: "watched", label: "Películas que he visto" },
];

/**
 * Columna izquierda de `/movies` (spec 003, RF-2): sin menú de destinos, solo
 * logotipo → `/`, Ordenar y Filtros. En ventana estrecha se esconde y se abre
 * con hamburguesa (panel superpuesto con overlay y Escape), mismo patrón que
 * `Menu.tsx`.
 */
function MoviesSidebar() {
  const { sort, setSort, genre, setGenre, show, setShow } = useMovies();
  const { enabled } = useViews();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeMenu]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        aria-label="Abrir Ordenar y Filtros"
        aria-expanded={open}
        aria-controls="movies-filters"
        onClick={() => setOpen(true)}
        className="ml-1 mt-3 self-start rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 lg:hidden"
      >
        <MenuIcon size={24} aria-hidden="true" />
      </button>

      {open && (
        <button
          type="button"
          aria-label="Cerrar Ordenar y Filtros"
          tabIndex={-1}
          onClick={closeMenu}
          className="fixed inset-0 z-40 cursor-default bg-black/60 lg:hidden"
        />
      )}

      <aside
        id="movies-filters"
        className={`fixed left-3 top-3 z-50 flex h-[calc(100vh-1.5rem)] w-64 shrink-0 flex-col rounded-2xl bg-slate-800 p-4 text-white shadow-lg transition-transform lg:static lg:m-3 lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Cerrar Ordenar y Filtros"
          onClick={closeMenu}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 lg:hidden"
        >
          <XIcon size={20} aria-hidden="true" />
        </button>

        <Link
          to="/"
          className="mb-6 px-3"
          aria-label="Volver al inicio"
          onClick={() => setOpen(false)}
        >
          <img src="logo.png" alt="Logotipo" />
        </Link>
        <div className="flex flex-col gap-6 overflow-y-auto pr-1">
          <section aria-label="Ordenar" className="space-y-2">
            <label
              htmlFor="movie-sort"
              className="block text-sm font-semibold text-slate-200"
            >
              Ordenar
            </label>
            <select
              id="movie-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as MovieSort)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </section>

          <section aria-label="Filtros" className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Filtros</h2>

            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase text-slate-400">
                Géneros
              </h3>
              <div className="flex flex-wrap gap-2">
                {MOVIE_GENRES.map((genreId) => {
                  const active = genre === genreId;

                  return (
                    <button
                      key={genreId}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setGenre(active ? null : genreId)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
                        active
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
                      }`}
                    >
                      {translateGenre(genreId)}
                    </button>
                  );
                })}
              </div>
            </div>

            {enabled && (
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase text-slate-400">
                  Mostrar
                </legend>
                {SHOW_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
                  >
                    <input
                      type="radio"
                      name="movies-show"
                      value={option.value}
                      checked={show === option.value}
                      onChange={() => setShow(option.value)}
                      className="h-4 w-4 accent-indigo-500"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

export default MoviesSidebar;