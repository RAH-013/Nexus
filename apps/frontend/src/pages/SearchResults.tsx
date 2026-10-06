import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PosterCard from "../components/home/PosterCard";
import SectionError from "../components/home/SectionError";
import { useSearch } from "../hooks/useSearch";

/** La vista pide más coincidencias que el panel (tope del endpoint: 50). */
const VIEW_LIMIT = 50;

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
 * Vista de resultados de búsqueda `/search?q=…` (enmienda de la spec 001):
 * se abre con Intro en el buscador o desde el panel, reutiliza la misma
 * máquina de estados que el panel y cada resultado navega a su ficha.
 * Estados: reposo (<3 car.), cargando, vacío, error con «Reintentar», límite
 * y coincidencias en cuadrícula con el aviso de «hay más».
 */
function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const trimmed = query.trim();
  const { status, items, hasMore, retry } = useSearch(query, VIEW_LIMIT);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold sm:text-xl">
        {trimmed ? `«${trimmed}»` : "Búsqueda"}
      </h2>

      {status === "idle" && (
        <EmptyBox>Escribe al menos 3 caracteres para ver resultados.</EmptyBox>
      )}

      {status === "loading" && <GridSkeleton />}

      {status === "error" && <SectionError onRetry={retry} />}

      {status === "rate-limit" && <SectionError variant="limit" />}

      {status === "empty" && (
        <EmptyBox>No se encontraron resultados para «{trimmed}».</EmptyBox>
      )}

      {status === "results" && (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {items.map((item, position) => (
              <li
                key={`${item.id}-${position}`}
                className="min-w-0 space-y-1.5"
              >
                <PosterCard
                  item={item}
                  className="aspect-2/3 w-full"
                  eager={position < 6}
                />
                <Link
                  to={`/title/${item.type}/${item.id}`}
                  title={item.name}
                  className="block truncate text-sm text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                >
                  {item.name}
                </Link>
                {item.year && (
                  <p className="text-xs text-slate-500">{item.year}</p>
                )}
              </li>
            ))}
          </ul>

          {hasMore && (
            <p className="text-sm text-slate-400">
              Hay más resultados para «{trimmed}». Refina la búsqueda para
              acotarlos.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default SearchResults;
