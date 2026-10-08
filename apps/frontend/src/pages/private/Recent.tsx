import { useCallback, useState, type ReactNode } from "react";
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
import SectionError from "../../components/home/SectionError";
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

/** Vacío de fila: la misma caja de las vistas Películas y Actores. */
function EmptyBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex min-h-40 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-10 text-center text-sm text-slate-300"
    >
      {children}
    </div>
  );
}

/** Esqueleto de fila mientras carga la primera página. */
function RowSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, position) => (
        <div
          key={position}
          className="h-28 animate-pulse rounded-xl bg-slate-800 [@media(prefers-reduced-motion:reduce)]:animate-none"
        />
      ))}
    </div>
  );
}

/** Estados que comparten las tres filas (carga, fallo, límite, vacío). */
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
    return <RowSkeleton />;
  }

  if (status === "error") {
    return <SectionError onRetry={retry} />;
  }

  if (status === "rate-limit") {
    return <SectionError variant="limit" />;
  }

  if (status === "unauthorized") {
    return (
      <p className="text-sm text-slate-400">
        Inicia sesión para ver tu actividad.
      </p>
    );
  }

  // «ready»: el vacío solo cuando no hay nada que mostrar.
  return isEmpty ? <EmptyBox>{emptyMessage}</EmptyBox> : null;
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
      className="h-24 w-16 shrink-0 rounded-lg object-cover"
    />
  ) : (
    <span
      role="img"
      aria-label={`Sin póster de ${name}`}
      className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-slate-500"
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
      <h2 className="text-lg font-semibold sm:text-xl">Vistas</h2>

      <RowStates
        status={status}
        retry={retry}
        isEmpty={items.length === 0}
        emptyMessage="No has visto títulos todavía."
      />

      {status !== "loading" && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <ViewCard key={`${item.type}:${item.externalId}`} item={item} />
          ))}
        </ul>
      )}

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
        className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-4 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        <PosterThumb poster={item.poster} name={item.name} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">
            {item.name}
          </span>
          <span className="mt-1 block text-xs text-slate-500">
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
      <h2 className="text-lg font-semibold sm:text-xl">
        Comentarios de títulos
      </h2>

      <RowStates
        status={status}
        retry={retry}
        isEmpty={items.length === 0}
        emptyMessage="No has comentado películas ni series todavía."
      />

      {status !== "loading" && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <CommentCard key={item.id} item={item} />
          ))}
        </ul>
      )}

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
        className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-4 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        <PosterThumb poster={item.poster} name={item.name} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-300">
            «{item.text}»
          </span>
          <span className="mt-1 block truncate text-sm font-semibold text-white">
            {item.name}
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            Comentario del {formatDate(item.date)}
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
      <h2 className="text-lg font-semibold sm:text-xl">
        Comentarios de actores
      </h2>

      <RowStates
        status={status}
        retry={retry}
        isEmpty={items.length === 0}
        emptyMessage="No has comentado actores todavía."
      />

      {status !== "loading" && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <ActorCommentCard key={item.id} item={item} />
          ))}
        </ul>
      )}

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
        className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-4 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
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
          <span className="block truncate text-sm font-semibold text-white">
            {item.actorName}
          </span>
          <span className="mt-1 block truncate text-sm text-slate-300">
            «{item.text}»
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            Comentario del {formatDate(item.date)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/* ================= PÁGINA ================= */

/**
 * «Recientes»: la actividad del usuario en tres filas con scroll
 * infinito y el mismo orden por tiempo. El título de la página lo
 * pone la cabecera (el `handle` de la ruta).
 */
function Recent() {
  const [order, setOrder] = useState<ActivityOrder>("desc");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div
          role="group"
          aria-label="Ordenar por tiempo"
          className="flex flex-wrap gap-2"
        >
          <button
            type="button"
            aria-pressed={order === "desc"}
            onClick={() => setOrder("desc")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
              order === "desc"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            Más recientes
          </button>
          <button
            type="button"
            aria-pressed={order === "asc"}
            onClick={() => setOrder("asc")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
              order === "asc"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
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
