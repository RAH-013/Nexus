import { useCallback, useEffect, useState } from "react";
import {
  apiGetActorComments,
  apiGetComments,
  apiPostActorComment,
  apiPostComment,
  type CommentEntry,
} from "../api/comments";
import type { MediaType } from "../api/cinemeta";
import { useUser } from "./useUser";

const COMMENT_MAX_LENGTH = 500;

/**
 * Destino de los comentarios: una ficha (`type` + `id`) o el
 * perfil de un actor (`actor`). La lógica de lista y publicación
 * es la misma; cambia solo el endpoint (RF-8).
 *
 * `target` debe tener identidad estable (p. ej. `useMemo` en la
 * sección de comentarios): el efecto y el envío dependen del
 * objeto, no solo de sus valores.
 */
export type CommentTarget =
  | { type: MediaType; id: string }
  | { actor: string };

/** Clave de caché del destino: única por título o actor. */
function targetKey(target: CommentTarget): string {
  return "actor" in target ? `actor:${target.actor}` : `${target.type}:${target.id}`;
}

/** Petición de lista según el destino. */
function loadComments(target: CommentTarget, signal?: AbortSignal) {
  return "actor" in target
    ? apiGetActorComments(target.actor, signal)
    : apiGetComments(target.type, target.id, signal);
}

/** Publicación según el destino. */
function postComment(target: CommentTarget, text: string, signal?: AbortSignal) {
  return "actor" in target
    ? apiPostActorComment(target.actor, text, signal)
    : apiPostComment(target.type, target.id, text, signal);
}

export type CommentsStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "rate-limit";

/** Motivo por el que no se publicó; el mensaje vive en la sección (D12). */
export type SubmitError =
  | "empty"
  | "too-long"
  | "session"
  | "rate-limit"
  | "error";

export type SubmitResult = { ok: true } | { ok: false; error: SubmitError };

interface CommentsState {
  comments: CommentEntry[];
  status: CommentsStatus;
  /** Repite solo la lista de comentarios (RF-8). */
  retry: () => void;
  /**
   * Valida en cliente y publica; si `ok`, la lista ya lleva el comentario
   * nuevo por delante (el backend devuelve la tarjeta creada).
   */
  submit: (text: string) => Promise<SubmitResult>;
}

/** Lo guardado pertenece a otra carga (`type:id#intento`). */
interface LoadedComments {
  key: string;
  comments: CommentEntry[];
  status: CommentsStatus;
}

export function useComments(target: CommentTarget): CommentsState {
  const { user } = useUser();
  const [attempt, setAttempt] = useState(0);
  const key = `${targetKey(target)}#${attempt}`;
  const [loaded, setLoaded] = useState<LoadedComments>({
    key,
    comments: [],
    status: "loading",
  });

  useEffect(() => {
    const requestKey = `${targetKey(target)}#${attempt}`;
    let active = true;

    void loadComments(target).then((result) => {
      if (!active) {
        return;
      }

      if (!result.success) {
        if (result.error === "aborted") {
          return;
        }

        setLoaded({
          key: requestKey,
          comments: [],
          status: result.error === "rate-limit" ? "rate-limit" : "error",
        });

        return;
      }

      setLoaded({
        key: requestKey,
        comments: result.data,
        status: result.data.length > 0 ? "ready" : "empty",
      });
    });

    return () => {
      active = false;
    };
  }, [target, attempt]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const submit = useCallback(
    async (text: string): Promise<SubmitResult> => {
      // Sin sesión no se envía nada: mejor avisar antes de escribir (D12.1).
      if (!user) {
        return { ok: false, error: "session" };
      }

      const trimmed = text.trim();

      if (!trimmed) {
        return { ok: false, error: "empty" };
      }

      if (trimmed.length > COMMENT_MAX_LENGTH) {
        return { ok: false, error: "too-long" };
      }

      const result = await postComment(target, trimmed);

      if (!result.success) {
        if (result.error === "aborted") {
          return { ok: false, error: "error" };
        }

        if (result.error === "unauthorized") {
          return { ok: false, error: "session" };
        }

        return {
          ok: false,
          error: result.error === "rate-limit" ? "rate-limit" : "error",
        };
      }

      // El comentario ya publicado se prepende sin volver a pedir la lista.
      setLoaded((current) => {
        const comments = [result.data, ...current.comments];

        return {
          ...current,
          comments,
          status: comments.length > 0 ? "ready" : "empty",
        };
      });

      return { ok: true };
    },
    [user, target],
  );

  const stale = loaded.key !== key;

  return {
    comments: stale ? [] : loaded.comments,
    status: stale ? "loading" : loaded.status,
    retry,
    submit,
  };
}
