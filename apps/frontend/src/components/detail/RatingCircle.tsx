const RADIUS = 54;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface RatingCircleProps {
  /** Nota de la fuente, tal cual llega (p. ej. «7.9»). */
  rating?: string;
}

/**
 * Tarjeta de ranking: aro oscuro con arco teal proporcional a la nota, la nota
 * al centro y rótulo «IMDb». La nota existe también como texto para lectores
 * de pantalla (RF-6, RNF-2). Sin nota parseable, no se pinta.
 */
function RatingCircle({ rating }: RatingCircleProps) {
  const value = rating === undefined ? Number.NaN : Number.parseFloat(rating);

  if (!Number.isFinite(value)) {
    return null;
  }

  const clamped = Math.min(Math.max(value, 0), 10);
  const offset = CIRCUMFERENCE * (1 - clamped / 10);

  return (
    <section
      aria-label="Ranking"
      className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/60 p-5 text-center"
    >
      <h2 className="text-lg font-semibold">Ranking</h2>

      <div role="img" aria-label={`IMDb: ${rating} sobre 10`} className="flex justify-center">
        <svg viewBox="0 0 120 120" className="h-36 w-36" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-slate-700"
          />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            className="text-teal-400"
          />
          <text
            x="60"
            y="62"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-white text-3xl font-bold"
          >
            {rating}
          </text>
        </svg>
      </div>

      <p className="text-sm text-slate-400">IMDb</p>
    </section>
  );
}

export default RatingCircle;
