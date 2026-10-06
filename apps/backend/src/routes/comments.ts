import { Router } from "express";
import { auth } from "../lib/auth";
import {
  createComment,
  listComments,
  validateCommentText,
  type CommentTextError,
} from "../services/comments";

export const commentsRouter = Router();

const MAX_ID_LENGTH = 80;

const COMMENT_TEXT_MESSAGES: Record<CommentTextError, string> = {
  invalid: "El comentario es requerido",
  empty: "El comentario no puede estar vacío",
  "too-long": "El comentario no puede superar 500 caracteres",
};

commentsRouter.get("/:type/:id", async (req, res) => {
  try {
    const params = parseTitleParams(req.params.type, req.params.id);

    if ("error" in params) {
      return res.status(400).json({ message: params.error });
    }

    const comments = await listComments(params.type, params.id);

    return res.json({ comments });
  } catch (error) {
    console.error("Error al cargar los comentarios:", error);

    return res.status(500).json({
      message: "No se pudieron cargar los comentarios",
    });
  }
});

commentsRouter.post("/:type/:id", async (req, res) => {
  try {
    const params = parseTitleParams(req.params.type, req.params.id);

    if ("error" in params) {
      return res.status(400).json({ message: params.error });
    }

    const session = await auth.api.getSession({ headers: toWebHeaders(req) });

    if (!session) {
      return res.status(401).json({
        message: "Inicia sesión para comentar",
      });
    }

    const body = req.body as { text?: unknown } | undefined;
    const validated = validateCommentText(body?.text);

    if (!validated.ok) {
      return res.status(400).json({ message: COMMENT_TEXT_MESSAGES[validated.reason] });
    }

    const comment = await createComment(
      params.type,
      params.id,
      session.user.id,
      validated.text,
    );

    return res.status(201).json(comment);
  } catch (error) {
    console.error("Error al publicar el comentario:", error);

    return res.status(500).json({
      message: "No se pudo publicar el comentario",
    });
  }
});

interface TitleParams {
  type: "movie" | "series";
  id: string;
}

/** Mismas reglas de type/id que la ficha de Cinemeta (spec 002, D11). */
function parseTitleParams(type: string, id: string): TitleParams | { error: string } {
  if (type !== "movie" && type !== "series") {
    return { error: "El tipo debe ser movie o series" };
  }

  if (!id.trim()) {
    return { error: "El ID es requerido" };
  }

  if (id.length > MAX_ID_LENGTH) {
    return { error: `El ID no puede superar ${MAX_ID_LENGTH} caracteres` };
  }

  return { type, id };
}

/** Convierte los headers de Express en `Headers` de web (igual que routes/auth.ts). */
function toWebHeaders(req: import("express").Request): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
  }

  return headers;
}

export { toWebHeaders };
