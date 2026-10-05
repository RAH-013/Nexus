interface SectionErrorProps {
  /**
   * `limit`: mensaje de límite de peticiones **sin** botón de reintento
   * inmediato (RF-13, RNF-6). Por defecto, mensaje + «Reintentar».
   */
  variant?: "default" | "limit";
  onRetry?: () => void;
}

function SectionError({ variant = "default", onRetry }: SectionErrorProps) {
  const isLimit = variant === "limit";

  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-4 rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-10 text-center"
    >
      <p className="max-w-md text-sm text-slate-300">
        {isLimit
          ? "Se alcanzó el límite de peticiones. Vuelve a intentarlo en unos minutos."
          : "No se pudieron cargar los títulos de esta sección."}
      </p>

      {!isLimit && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export default SectionError;
