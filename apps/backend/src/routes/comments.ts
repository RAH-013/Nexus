import { Router, type Response } from "express";
import { auth } from "../lib/auth";
import {
  createComment,
  getComment,
  listComments,
  validateCommentText,
  type CommentTextError,
} from "../services/comments";

export const commentsRouter = Router();

const MAX_ID_LENGTH = 80;

/** Error del recurso con el formato `{"error", "detalles"}` del ticket. */
function commentError(
  res: Response,
  status: number,
  error: string,
  detalles: string[] = [],
) {
  return res.status(status).json({ error, detalles });
}

const COMMENT_TEXT_MESSAGES: Record<CommentTextError, string> = {
  invalid: "El comentario es requerido",
  empty: "El comentario no puede estar vacío",
  "too-long": "El comentario no puede superar 500 caracteres",
};

commentsRouter.get("/:type/:id", async (req, res) => {
  try {
    const params = parseTitleParams(req.params.type, req.params.id);

    if ("error" in params) {
      return commentError(res, 400, "Datos inválidos", [params.error]);
    }

    const comments = await listComments(params.type, params.id);

    return res.json({ comments });
  } catch (error) {
    console.error("Error al cargar los comentarios:", error);

    return commentError(res, 500, "No se pudieron cargar los comentarios");
  }
});

commentsRouter.get("/:type/:id/:commentId", async (req, res) => {
  try {
    const params = parseTitleParams(req.params.type, req.params.id);

    if ("error" in params) {
      return commentError(res, 400, "Datos inválidos", [params.error]);
    }

    const commentId = parseCommentId(req.params.commentId);

    if ("error" in commentId) {
      return commentError(res, 400, "Datos inválidos", [commentId.error]);
    }

    const comment = await getComment(params.type, params.id, commentId.value);

    if (!comment) {
      return commentError(res, 404, "Comentario no encontrado");
    }

    return res.json(comment);
  } catch (error) {
    console.error("Error al cargar el comentario:", error);

    return commentError(res, 500, "No se pudo cargar el comentario");
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

/** ID de comentario de la ruta: entero positivo. */
function parseCommentId(raw: string): { value: number } | { error: string } {
  const value = Number(raw);

  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1) {
    return { error: "El ID del comentario debe ser un entero positivo" };
  }

  return { value };
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
