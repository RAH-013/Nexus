import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ClapIcon } from "lucide-animated";
import {
  apiGetRecentActorComments,
  apiGetRecentComments,
  apiGetRecentViews,
  type ActivityOrder,
  type RecentActorComment,
  type RecentComment,
  type RecentView,
} from "../../api/activity";
import {
  useInfiniteActivity,
  type InfiniteStatus,
} from "../../hooks/useInfiniteActivity";
import { colorOf, initialsOf } from "../../utils/actorAvatar";

/** Fecha corta de cada tarjeta («3 oct»). */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** Fallo de una fila con «Reintentar»: no afecta a las otras filas. */
function RowError({ onRetry }: { onRetry: () => void }) {
  return (
    <p role="alert" className="text-sm text-rose-300">
      No se pudo cargar la fila.{" "}
      <button
        type="button"
        onClick={onRetry}
        className="font-medium text-indigo-300 underline underline-offset-2"
      >
        Reintentar
      </button>
    </p>
  );
}

function RowLimit() {
  return (
    <p role="alert" className="text-sm text-amber-300">
      Se alcanzó el límite de peticiones. Vuelve a intentarlo en unos minutos.
    </p>
  );
}

/** Estados que comparten las tres filas. */
function RowStates({
  status,
  retry,
  isEmpty,
  emptyMessage,
}: {
  status: InfiniteStatus;
  retry: () => void;
  isEmpty: boolean;
  emptyMessage: string;
}) {
  if (status === "loading") {
    return <p className="text-sm text-slate-400">Cargando…</p>;
  }

  if (status === "error") {
    return <RowError onRetry={retry} />;
  }

  if (status === "rate-limit") {
    return <RowLimit />;
  }

  if (status === "unauthorized") {
    return (
      <p className="text-sm text-slate-400">
        Inicia sesión para ver tu actividad.
      </p>
    );
  }

  // «ready»: el mensaje vacío solo cuando no hay nada que mostrar.
  return isEmpty ? (
    <p className="text-sm text-slate-400">{emptyMessage}</p>
  ) : null;
}

/** Póster con reserva (icono si no hay o si falla), como `PosterCard`. */
function PosterThumb({ poster, name }: { poster?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  const withImage = Boolean(poster) && !broken;

  return withImage ? (
    <img
      src={poster}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-24 w-16 shrink-0 rounded-md object-cover"
    />
  ) : (
    <span
      role="img"
      aria-label={`Sin póster de ${name}`}
      className="flex h-24 w-16 shrink-0 items-center justify-center rounded-md bg-slate-700 text-slate-500"
    >
      <ClapIcon size={24} animateOnHover={false} aria-hidden="true" />
    </span>
  );
}

/* ================= FILA 1: VISTAS ================= */

function ViewsRow({ order }: { order: ActivityOrder }) {
  // La petición depende del orden: al cambiarlo se pide de nuevo.
  const load = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      apiGetRecentViews(order, cursor, signal),
    [order],
  );

  const { items, status, sentinelRef, retry } =
    useInfiniteActivity<RecentView>(load, order);

  return (
    <section aria-label="Vistas" className="space-y-3">
      <h2 className="text-lg font-semibold">Vistas</h2>

      <RowStates
        status={status}
        retry={retry}
        isEmpty={items.length === 0}
        emptyMessage="No has visto títulos todavía."
      />

      <ul className="space-y-3">
        {items.map((item) => (
          <ViewCard key={`${item.type}:${item.externalId}`} item={item} />
        ))}
      </ul>

      {/* Centinela: al entrar en pantalla se pide la siguiente página. */}
      <div ref={sentinelRef} aria-hidden="true" className="h-2" />
    </section>
  );
}

/** Título visto: clic en cualquier parte abre su ficha. */
function ViewCard({ item }: { item: RecentView }) {
  return (
    <li>
      <Link
        to={`/title/${item.type}/${encodeURIComponent(item.externalId)}`}
        aria-label={`Ver ficha de ${item.name}`}
        className="flex items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-800/60 p-3 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        <PosterThumb poster={item.poster} name={item.name} />

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-white">
            {item.name}
          </span>
          <span className="block text-xs text-slate-400">
            {item.type === "movie" ? "Película" : "Serie"} · Vista el{" "}
            {formatDate(item.date)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/* ================= FILA 2: COMENTARIOS DE TÍTULOS ================= */

function CommentsRow({ order }: { order: ActivityOrder }) {
  const load = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      apiGetRecentComments(order, cursor, signal),
    [order],
  );

  const { items, status, sentinelRef, retry } =
    useInfiniteActivity<RecentComment>(load, order);

  return (
    <section aria-label="Comentarios de títulos" className="space-y-3">
      <h2 className="text-lg font-semibold">Comentarios de títulos</h2>

      <RowStates
        status={status}
        retry={retry}
        isEmpty={items.length === 0}
        emptyMessage="No has comentado películas ni series todavía."
      />

      <ul className="space-y-3">
        {items.map((item) => (
          <CommentCard key={item.id} item={item} />
        ))}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" className="h-2" />
    </section>
  );
}

/** Comentario: el texto a un lado del póster del título al que pertenece. */
function CommentCard({ item }: { item: RecentComment }) {
  return (
    <li>
      <Link
        to={`/title/${item.type}/${encodeURIComponent(item.externalId)}`}
        aria-label={`Ver ficha de ${item.name}`}
        className="flex items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-800/60 p-3 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        <PosterThumb poster={item.poster} name={item.name} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-200">
            «{item.text}»
          </span>
          <span className="mt-1 block truncate text-xs text-slate-400">
            {item.name} · {formatDate(item.date)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/* ================= FILA 3: COMENTARIOS DE ACTORES ================= */

function ActorCommentsRow({ order }: { order: ActivityOrder }) {
  const load = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      apiGetRecentActorComments(order, cursor, signal),
    [order],
  );

  const { items, status, sentinelRef, retry } =
    useInfiniteActivity<RecentActorComment>(load, order);

  return (
    <section aria-label="Comentarios de actores" className="space-y-3">
      <h2 className="text-lg font-semibold">Comentarios de actores</h2>

      <RowStates
        status={status}
        retry={retry}
        isEmpty={items.length === 0}
        emptyMessage="No has comentado actores todavía."
      />

      <ul className="space-y-3">
        {items.map((item) => (
          <ActorCommentCard key={item.id} item={item} />
        ))}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" className="h-2" />
    </section>
  );
}

/** Comentario de actor: foto de TMDB (iniciales de reserva) y nombre. */
function ActorCommentCard({ item }: { item: RecentActorComment }) {
  return (
    <li>
      <Link
        to={`/actor/${encodeURIComponent(item.actorName)}`}
        aria-label={`Ver perfil de ${item.actorName}`}
        className="flex items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-800/60 p-3 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={`Foto de ${item.actorName}`}
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${colorOf(item.actorName)}`}
          >
            {initialsOf(item.actorName)}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-white">
            {item.actorName}
          </span>
          <span className="block truncate text-sm text-slate-300">
            «{item.text}»
          </span>
          <span className="block text-xs text-slate-400">
            Comentario del {formatDate(item.date)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/* ================= PÁGINA ================= */

function sortButtonClass(active: boolean): string {
  return `px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
    active ? "bg-indigo-600 text-white" : "text-slate-300 hover:text-white"
  }`;
}

/**
 * «Recientes»: la actividad del usuario en tres filas con scroll
 * infinito y el mismo orden por tiempo. El título de la página lo
 * pone la cabecera (el `handle` de la ruta).
 */
function Recent() {
  const [order, setOrder] = useState<ActivityOrder>("desc");

  return (
    <div className="space-y-10">
      <div className="flex justify-end">
        <div
          role="group"
          aria-label="Ordenar por tiempo"
          className="flex overflow-hidden rounded-lg border border-slate-700 text-sm"
        >
          <button
            type="button"
            aria-pressed={order === "desc"}
            onClick={() => setOrder("desc")}
            className={sortButtonClass(order === "desc")}
          >
            Más recientes
          </button>
          <button
            type="button"
            aria-pressed={order === "asc"}
            onClick={() => setOrder("asc")}
            className={sortButtonClass(order === "asc")}
          >
            Más antiguos
          </button>
        </div>
      </div>

      <ViewsRow order={order} />
      <CommentsRow order={order} />
      <ActorCommentsRow order={order} />
    </div>
  );
}

export default Recent;