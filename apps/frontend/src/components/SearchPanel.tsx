import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useSearch } from "../hooks/useSearch";
import PosterCard from "./home/PosterCard";

interface SearchPanelProps {
  query: string;
  onClose: () => void;
  onNavigate?: () => void;
}

function PanelMessage({ children }: { children: ReactNode }) {
  return <p className="px-4 py-5 text-sm text-slate-300">{children}</p>;
}

function SearchPanel({ query, onClose, onNavigate }: SearchPanelProps) {
  const { status, items, hasMore } = useSearch(query);
  const trimmed = query.trim();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      role="region"
      aria-label="Resultados de búsqueda"
      onMouseDown={(event) => event.preventDefault()}
    >
      <div aria-live="polite">
        {status === "loading" && (
          <div className="space-y-2 p-3" aria-hidden="true">
            {Array.from({ length: 3 }, (_, position) => (
              <div
                key={position}
                className="flex animate-pulse items-center gap-3 [@media(prefers-reduced-motion:reduce)]:animate-none"
              >
                <div className="h-16 w-11 shrink-0 rounded-lg bg-slate-700" />
                <div className="h-4 flex-1 rounded bg-slate-700" />
              </div>
            ))}
          </div>
        )}

        {status === "error" && (
          <PanelMessage>
            No se pudieron cargar los resultados. Sigue escribiendo para volver
            a pedirlos.
          </PanelMessage>
        )}

        {status === "rate-limit" && (
          <PanelMessage>
            Se alcanzó el límite de peticiones. Vuelve a intentarlo en unos
            minutos.
          </PanelMessage>
        )}

        {status === "empty" && (
          <PanelMessage>
            No se encontraron resultados para «{trimmed}».
          </PanelMessage>
        )}

        {status === "results" && (
          <>
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {items.map((item, position) => (
                <li key={`${item.id}-${position}`}>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <PosterCard
                      item={item}
                      className="h-16 w-11 shrink-0"
                      onNavigate={onNavigate}
                    />

                    <Link
                      to={`/title/${item.type}/${item.id}`}
                      onClick={onNavigate}
                      className="min-w-0 flex-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                    >
                      <p className="truncate text-sm text-white">{item.name}</p>
                      <p className="text-xs text-slate-400">
                        {item.year ?? ""}
                      </p>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-slate-700 px-3 py-2 text-xs text-slate-400">
              {hasMore && <p>Hay más resultados para «{trimmed}».</p>}

              <Link
                to={`/search?q=${encodeURIComponent(trimmed)}`}
                onClick={onNavigate}
                className="mt-1 inline-block font-medium text-teal-400 underline hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
              >
                Ver todos los resultados
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SearchPanel;
