import { useState } from "react";
import { Link } from "react-router-dom";
import { ClapIcon } from "lucide-animated";
import type { MediaItem } from "../../api/cinemeta";

interface PosterCardProps {
  item: MediaItem;
  /** Define el tamaño del bloque de póster (carril de fila, panel de búsqueda…). */
  className?: string;
  /** Las primeras posiciones se adelantan para no esperar a toda la fila (RNF-1). */
  eager?: boolean;
  /** El panel de búsqueda cierra al navegar a la ficha (spec 002, D5). */
  onNavigate?: () => void;
  /** Fuera de ranura en el carrusel: sin foco ni clic (spec 002, RNF-2). */
  inert?: boolean;
}

/**
 * Póster de un título con marcador de reserva. Es un enlace a su ficha:
 * clic o Intro navegan (spec 002, D4) y el clic derecho sigue permitiendo
 * «abrir en pestaña nueva».
 */
function PosterCard({
  item,
  className = "h-60 w-40",
  eager = false,
  onNavigate,
  inert = false,
}: PosterCardProps) {
  const [broken, setBroken] = useState(false);
  const withImage = Boolean(item.poster) && !broken;

  return (
    <Link
      to={`/title/${item.type}/${item.id}`}
      onClick={onNavigate}
      inert={inert}
      aria-label={`Ver ficha de ${item.name}`}
      className={`relative block shrink-0 overflow-hidden rounded-lg bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${className}`}
    >
      {withImage ? (
        <img
          src={item.poster}
          alt={item.name}
          loading={eager ? "eager" : "lazy"}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`Sin póster de ${item.name}`}
          className="flex h-full w-full items-center justify-center bg-slate-700 text-slate-500"
        >
          <ClapIcon size={28} animateOnHover={false} aria-hidden="true" />
        </div>
      )}
    </Link>
  );
}

export default PosterCard;
