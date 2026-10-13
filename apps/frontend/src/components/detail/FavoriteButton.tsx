import { HeartIcon } from "lucide-animated";
import type { MediaType } from "../../api/cinemeta";
import { useReactions } from "../../hooks/useReactions";

interface FavoriteButtonProps {
  id: string;
  type?: MediaType;
}

/**
 * «Añadir a favoritos» / «Favorito» (spec 004, RF-1): solo con sesión,
 * siempre fuera de los enlaces para que el clic no navegue. El estado solo
 * cambia con la respuesta del servidor y mientras hay una petición en
 * vuelo el botón queda deshabilitado (doble clic → un solo cambio).
 */
function FavoriteButton({ id, type = "movie" }: FavoriteButtonProps) {
  const { isFavorite, isPending, toggleFavorite, enabled } = useReactions();

  if (!enabled) {
    return null;
  }

  const favorite = isFavorite(id);
  const pending = isPending(id);

  return (
    <button
      type="button"
      aria-pressed={favorite}
      disabled={pending}
      onClick={() => void toggleFavorite(type, id)}
      className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 ${
        favorite
          ? "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 focus-visible:outline-rose-400"
          : "bg-slate-700 text-slate-200 hover:bg-slate-600 focus-visible:outline-indigo-400"
      }`}
    >
      {/* Tamaño real = prop `size` (el div envolvente lleva inline style;
          las clases h-/w- no lo cambian). 14 px cabe en la línea del text-xs. */}
      <HeartIcon
        size={14}
        className={favorite ? "fill-current" : ""}
        aria-hidden="true"
      />
      {favorite ? "Favorito" : "Añadir a favoritos"}
    </button>
  );
}

export default FavoriteButton;
