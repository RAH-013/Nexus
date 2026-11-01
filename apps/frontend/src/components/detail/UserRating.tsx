import { useState } from "react";
import type { MediaType } from "../../api/cinemeta";
import { useInteractions } from "../../hooks/useInteractions";

interface UserRatingProps {
  id: string;
  type: MediaType;
}

const STAR_LABELS = [
  "1 estrella - Mala",
  "2 estrellas - Regular",
  "3 estrellas - Buena",
  "4 estrellas - Muy buena",
  "5 estrellas - Excelente",
];

export default function UserRating({ id, type }: UserRatingProps) {
  const { getRating, setRating, isPending, enabled } = useInteractions();
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  if (!enabled) {
    return null;
  }

  const currentRating = getRating(id) ?? 0;
  const pending = isPending(id);
  const activeRating = hoverValue ?? currentRating;

  const handleClick = (starValue: number) => {
    if (pending) return;
    // Si hace clic en la misma estrella actual, se remueve la calificación
    const nextValue = starValue === currentRating ? 0 : starValue;
    void setRating(type, id, nextValue);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Tu valoración
        </span>
        <span className="text-xs text-slate-400">
          {currentRating > 0 ? `${currentRating} de 5 estrellas` : "Sin valorar"}
        </span>
      </div>

      <div
        className="mt-3 flex items-center justify-center gap-1.5"
        role="group"
        aria-label="Calificar con estrellas"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= activeRating;

          return (
            <button
              key={star}
              type="button"
              disabled={pending}
              onClick={() => handleClick(star)}
              onMouseEnter={() => setHoverValue(star)}
              onMouseLeave={() => setHoverValue(null)}
              onFocus={() => setHoverValue(star)}
              onBlur={() => setHoverValue(null)}
              aria-label={STAR_LABELS[star - 1]}
              className="rounded p-1 text-slate-600 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill={filled ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={filled ? "0" : "1.8"}
                className={`h-7 w-7 transition-colors ${
                  filled ? "text-amber-400" : "text-slate-500 hover:text-amber-300"
                }`}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
