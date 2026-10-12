import type { MediaType } from "../../api/cinemeta";
import { useReactions } from "../../hooks/useReactions";

interface LikeButtonsProps {
  id: string;
  type?: MediaType;
}

/**
 * «Me gusta» / «No me gusta» (spec 004, RF-1 y RF-3): se excluyen mutuamente
 * en el servidor (activar uno quita el otro). Solo con sesión; el estado solo
 * cambia con la respuesta y mientras hay una petición en vuelo ambos quedan
 * deshabilitados (doble clic → un solo cambio).
 */
function LikeButtons({ id, type = "movie" }: LikeButtonsProps) {
  const { isLiked, isDisliked, isPending, toggleLike, toggleDislike, enabled } =
    useReactions();

  if (!enabled) {
    return null;
  }

  const liked = isLiked(id);
  const disliked = isDisliked(id);
  const pending = isPending(id);

  const baseClass =
    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-pressed={liked}
        disabled={pending}
        onClick={() => void toggleLike(type, id)}
        className={`${baseClass} ${
          liked
            ? "bg-teal-500/15 text-teal-300 hover:bg-teal-500/25 focus-visible:outline-teal-400"
            : disliked
              ? "bg-slate-700 text-slate-400 hover:bg-slate-600 focus-visible:outline-teal-400"
              : "bg-slate-700 text-slate-200 hover:bg-slate-600 focus-visible:outline-teal-400"
        }`}
      >
        Me gusta
      </button>

      <button
        type="button"
        aria-pressed={disliked}
        disabled={pending}
        onClick={() => void toggleDislike(type, id)}
        className={`${baseClass} ${
          disliked
            ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 focus-visible:outline-amber-400"
            : liked
              ? "bg-slate-700 text-slate-400 hover:bg-slate-600 focus-visible:outline-amber-400"
              : "bg-slate-700 text-slate-200 hover:bg-slate-600 focus-visible:outline-amber-400"
        }`}
      >
        No me gusta
      </button>
    </div>
  );
}

export default LikeButtons;
