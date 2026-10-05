import { useEffect, type ReactNode } from "react";
import { useSearch } from "../hooks/useSearch";
import PosterCard from "./home/PosterCard";

interface SearchPanelProps {
  query: string;
  /** Escape cierra el panel (RF-8); el resto del cierre vive en `Header`. */
  onClose: () => void;
  /**
   * Navegar a una ficha también cierra el panel: `Header` no se desmonta al
   * entrar en la ficha y sin esto el panel quedaría abierto (spec 002, D5).
   */
  onNavigate?: () => void;
}

function PanelMessage({ children }: { children: ReactNode }) {
  return <p className="px-4 py-5 text-sm text-slate-300">{children}</p>;
}

/**
 * Panel desplegado bajo el campo de búsqueda: hasta 10 resultados que llevan
 * a su ficha (clic o teclado, cerrando el panel), aviso de «hay más» y
 * mensajes de vacío y de error (RF-7, RF-8).
 */
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
      className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,26rem)] overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-xl"
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
          <PanelMessage>No se encontraron resultados para «{trimmed}».</PanelMessage>
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
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.year ?? ""}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {hasMore && (
              <p className="border-t border-slate-700 px-3 py-2 text-xs text-slate-400">
                Hay más resultados para «{trimmed}».
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SearchPanel;
