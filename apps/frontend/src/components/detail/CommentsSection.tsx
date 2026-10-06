import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UserIcon } from "lucide-animated";
import type { MediaType } from "../../api/cinemeta";
import type { CommentTarget } from "../../hooks/useComments";
import { useComments, type SubmitError } from "../../hooks/useComments";

type CommentsSectionProps =
  | { type: MediaType; id: string; actor?: undefined }
  | { type?: undefined; id?: undefined; actor: string };

const SUBMIT_MESSAGES: Record<SubmitError, string> = {
  empty: "El comentario no puede estar vacío.",
  "too-long": "El comentario no puede superar 500 caracteres.",
  session: "Inicia sesión para comentar.",
  "rate-limit":
    "Se alcanzó el límite de peticiones. Vuelve a intentarlo en unos minutos.",
  error: "No se pudo publicar el comentario. Inténtalo de nuevo.",
};

/**
 * Sección «Comentarios»: compositor con textarea y «Publicar» y, debajo, las
 * tarjetas de autor + texto. Cada mensaje vive aquí y un fallo suyo no afecta
 * al resto de la ficha (RF-8, RNF-5, D16). Vale para una ficha
 * (`type` + `id`) y para el perfil de un actor (`actor`).
 */
function CommentsSection(props: CommentsSectionProps) {
  // Identidad estable del destino: el hook depende del objeto
  // (sus valores), no de cada render del padre.
  const target = useMemo<CommentTarget>(
    () =>
      props.actor !== undefined
        ? { actor: props.actor }
        : { type: props.type, id: props.id },
    [props.actor, props.type, props.id],
  );
  const { comments, status, retry, submit } = useComments(target);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<SubmitError | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSending(true);
    const result = await submit(text);
    setSending(false);

    if (result.ok) {
      // La tarjeta ya está en la lista: se limpia el campo y el aviso.
      setText("");
      setNotice(null);
      return;
    }

    // Fallo: se conserva el texto escrito y el reintento es manual (caso 17).
    setNotice(result.error);
  };

  return (
    <section
      aria-label="Comentarios"
      className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/60 p-5"
    >
      <h2 className="text-lg font-semibold">Comentarios</h2>

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setNotice(null);
          }}
          maxLength={500}
          rows={3}
          aria-label="Escribe un comentario"
          placeholder="Escribe un comentario…"
          className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
        />

        <div className="flex items-center justify-between gap-3">
          <div aria-live="polite" className="min-w-0 text-sm">
            {notice === "session" ? (
              <p className="text-amber-300">
                Inicia sesión para comentar.{" "}
                <Link
                  to="/auth"
                  className="font-medium text-teal-400 underline hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                >
                  Iniciar sesión
                </Link>
              </p>
            ) : (
              notice && <p className="text-amber-300">{SUBMIT_MESSAGES[notice]}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={sending}
            className="shrink-0 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            Publicar
          </button>
        </div>
      </form>

      <div aria-live="polite" className="space-y-3">
        {status === "loading" && (
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 2 }, (_, position) => (
              <div
                key={position}
                className="animate-pulse rounded-xl bg-slate-800 p-4 [@media(prefers-reduced-motion:reduce)]:animate-none"
              >
                <div className="h-4 w-1/4 rounded bg-slate-700" />
                <div className="mt-3 h-4 w-3/4 rounded bg-slate-700" />
              </div>
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-300">
              No se pudieron cargar los comentarios.
            </p>
            <button
              type="button"
              onClick={retry}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              Reintentar
            </button>
          </div>
        )}

        {status === "rate-limit" && (
          <p className="text-center text-sm text-slate-300">
            Se alcanzó el límite de peticiones. Vuelve a intentarlo en unos
            minutos.
          </p>
        )}

        {status === "empty" && (
          <p className="text-center text-sm text-slate-400">
            Todavía no hay comentarios. Sé el primero en comentar.
          </p>
        )}

        {status === "ready" && (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-xl border border-slate-700 bg-slate-800 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-400">
                    <UserIcon size={18} animateOnHover={false} aria-hidden="true" />
                  </span>
                  <p className="min-w-0 truncate text-sm font-semibold text-white">
                    {comment.author}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">
                  {comment.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default CommentsSection;
