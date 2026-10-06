import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MenuIcon, XIcon } from "lucide-animated";
import { useActors } from "../../hooks/useActors";
import type { ActorsSort } from "../../utils/actorsList";

const SORT_OPTIONS: { value: ActorsSort; label: string }[] = [
  { value: "count", label: "Más películas" },
  { value: "name", label: "Alfabético (A-Z)" },
];

/**
 * Columna izquierda de `/actors`: sin menú de destinos, solo
 * logotipo → `/`, Ordenar por y Buscar. En ventana estrecha se esconde y se
 * abre con hamburguesa (panel superpuesto con overlay y Escape).
 */
function ActorsSidebar() {
  const { sort, setSort, query, setQuery } = useActors();
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
        aria-label="Abrir Ordenar y Buscar"
        aria-expanded={open}
        aria-controls="actors-filters"
        onClick={() => setOpen(true)}
        className="ml-1 mt-3 self-start rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 lg:hidden"
      >
        <MenuIcon size={24} aria-hidden="true" />
      </button>

      {open && (
        <button
          type="button"
          aria-label="Cerrar Ordenar y Buscar"
          tabIndex={-1}
          onClick={closeMenu}
          className="fixed inset-0 z-40 cursor-default bg-black/60 lg:hidden"
        />
      )}

      <aside
        id="actors-filters"
        className={`fixed left-3 top-3 z-50 flex h-[calc(100vh-1.5rem)] w-64 shrink-0 flex-col rounded-2xl bg-slate-800 p-4 text-white shadow-lg transition-transform lg:static lg:m-3 lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Cerrar Ordenar y Buscar"
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
              htmlFor="actors-sort"
              className="block text-sm font-semibold text-slate-200"
            >
              Ordenar por
            </label>
            <select
              id="actors-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as ActorsSort)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </section>

          <section aria-label="Buscar" className="space-y-2">
            <label
              htmlFor="actors-search"
              className="block text-sm font-semibold text-slate-200"
            >
              Buscar
            </label>
            <input
              id="actors-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Escribe un nombre…"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            />
          </section>
        </div>
      </aside>
    </>
  );
}

export default ActorsSidebar;
