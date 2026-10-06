import type { MediaType } from "../../api/cinemeta";
import { useViews } from "../../hooks/useViews";

interface WatchButtonProps {
  id: string;
  type?: MediaType;
}

/**
 * «Marcar como vista» / «Vista» (spec 003, RF-9 en cards y RF-10 en la ficha):
 * solo con sesión, visible sin hover (táctil) y siempre fuera de los enlaces
 * para que el clic no navegue. El estado solo cambia con la respuesta del
 * servidor y mientras hay una petición en vuelo el botón queda deshabilitado
 * (doble clic → un solo cambio).
 */
function WatchButton({ id, type = "movie" }: WatchButtonProps) {
  const { isViewed, isPending, toggle, enabled } = useViews();

  if (!enabled) {
    return null;
  }

  const viewed = isViewed(id);
  const pending = isPending(id);

  return (
    <button
      type="button"
      aria-pressed={viewed}
      disabled={pending}
      onClick={() => void toggle(id, type)}
      className={`mt-1 w-full rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 ${
        viewed
          ? "bg-teal-500/15 text-teal-300 hover:bg-teal-500/25 focus-visible:outline-teal-400"
          : "bg-slate-700 text-slate-200 hover:bg-slate-600 focus-visible:outline-indigo-400"
      }`}
    >
      {viewed ? "Vista" : "Marcar como vista"}
    </button>
  );
}

export default WatchButton;