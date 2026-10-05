import { UserIcon } from "lucide-animated";

interface CastSectionProps {
  director?: string[];
  cast?: string[];
}

interface CastRow {
  name: string;
  role: string;
  accent: boolean;
}

/**
 * Reparto: `director[]` primero rotulado «Dirección» y después `cast[]` como
 * «Reparto», en el orden de la fuente y sin deduplicar; avatar genérico y
 * nombre, nada de fotos ni personajes (RF-4). Sin datos, no se pinta.
 */
function CastSection({ director = [], cast = [] }: CastSectionProps) {
  if (director.length === 0 && cast.length === 0) {
    return null;
  }

  const rows: CastRow[] = [
    ...director.map((name) => ({ name, role: "Dirección", accent: true })),
    ...cast.map((name) => ({ name, role: "Reparto", accent: false })),
  ];

  return (
    <section
      aria-label="Reparto"
      className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/60 p-5"
    >
      <h2 className="text-lg font-semibold">Reparto</h2>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {rows.map((row, position) => (
          <li key={`${row.role}-${row.name}-${position}`} className="min-w-0 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-700 text-slate-400">
              <UserIcon size={26} animateOnHover={false} aria-hidden="true" />
            </span>
            <p className="mt-2 truncate text-sm text-white" title={row.name}>
              {row.name}
            </p>
            <p className={`text-xs ${row.accent ? "text-teal-400" : "text-slate-400"}`}>
              {row.role}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default CastSection;
