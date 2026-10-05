import { useCallback, useEffect, useState } from "react";
import {
  apiGetComments,
  apiPostComment,
  type CommentEntry,
} from "../api/comments";
import type { MediaType } from "../api/cinemeta";
import { useUser } from "./useUser";

const COMMENT_MAX_LENGTH = 500;

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

export function useComments(type: MediaType, id: string): CommentsState {
  const { user } = useUser();
  const [attempt, setAttempt] = useState(0);
  const key = `${type}:${id}#${attempt}`;
  const [loaded, setLoaded] = useState<LoadedComments>({
    key,
    comments: [],
    status: "loading",
  });

  useEffect(() => {
    const requestKey = `${type}:${id}#${attempt}`;
    let active = true;

    void apiGetComments(type, id).then((result) => {
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
  }, [type, id, attempt]);

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

      const result = await apiPostComment(type, id, trimmed);

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
    [user, type, id],
  );

  const stale = loaded.key !== key;

  return {
    comments: stale ? [] : loaded.comments,
    status: stale ? "loading" : loaded.status,
    retry,
    submit,
  };
}
