/**
 * Skeleton con la disposición definitiva de la ficha: tres columnas en
 * escritorio (tarjeta · sinopsis · ranking) y apilado en pantalla estrecha,
 * sin animación cuando el sistema pide «reducir movimiento» (RF-7, RNF-2).
 */
function DetailSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid animate-pulse gap-6 [@media(prefers-reduced-motion:reduce)]:animate-none lg:grid-cols-[1fr_1.4fr_1fr]"
    >
      {/* Izquierda: tarjeta + reparto */}
      <div className="space-y-4">
        <div className="h-8 w-3/4 rounded bg-slate-800" />
        <div className="aspect-2/3 w-full max-w-72 rounded-lg bg-slate-800" />
        <div className="h-4 w-2/3 rounded bg-slate-800" />
        <div className="h-44 rounded-xl bg-slate-800" />
      </div>

      {/* Centro: sinopsis + comentarios */}
      <div className="space-y-4">
        <div className="h-6 w-1/3 rounded bg-slate-800" />
        <div className="h-4 w-full rounded bg-slate-800" />
        <div className="h-4 w-11/12 rounded bg-slate-800" />
        <div className="h-4 w-10/12 rounded bg-slate-800" />
        <div className="h-4 w-4/6 rounded bg-slate-800" />
        <div className="h-6 w-1/3 rounded bg-slate-800 pt-4" />
        <div className="h-44 rounded-xl bg-slate-800" />
      </div>

      {/* Derecha: ranking */}
      <div className="space-y-4">
        <div className="h-6 w-1/2 rounded bg-slate-800" />
        <div className="mx-auto h-36 w-36 rounded-full bg-slate-800" />
      </div>
    </div>
  );
}

export default DetailSkeleton;
