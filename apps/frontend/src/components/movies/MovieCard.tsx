import { Link } from "react-router-dom";
import type { MediaItem } from "../../api/cinemeta";
import PosterCard from "../home/PosterCard";
import WatchButton from "./WatchButton";

/**
 * Card de la cuadrícula de Películas (spec 003, D9): póster y título navegan
 * a la ficha (título truncado si es largo, caso 20), el año se omite si no
 * existe y «Marcar como vista» queda fuera de los enlaces para no navegar.
 */
function MovieCard({ item }: { item: MediaItem }) {
  return (
    <div className="space-y-1.5">
      <PosterCard item={item} className="aspect-2/3 w-full" />

      <Link
        to={`/title/${item.type}/${item.id}`}
        title={item.name}
        className="block truncate text-sm text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        {item.name}
      </Link>

      {item.year && <p className="text-xs text-slate-500">{item.year}</p>}

      <WatchButton id={item.id} />
    </div>
  );
}

export default MovieCard;