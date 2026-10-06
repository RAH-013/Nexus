import { Router } from "express";
import { auth } from "../lib/auth";
import { cinemetaService } from "../services/cinemeta";
import {
  createActorComment,
  listActorComments,
  validateCommentText,
  type CommentTextError,
} from "../services/actorComments";
import { toWebHeaders } from "./comments";

export const actorCommentsRouter = Router();

const MAX_NAME_LENGTH = 80;

const COMMENT_TEXT_MESSAGES: Record<CommentTextError, string> = {
  invalid: "El comentario es requerido",
  empty: "El comentario no puede estar vacío",
  "too-long": "El comentario no puede superar 500 caracteres",
};

actorCommentsRouter.get("/:name/comments", async (req, res) => {
  try {
    const name = parseName(req.params.name);

    if ("error" in name) {
      return res.status(400).json({ message: name.error });
    }

    const comments = await listActorComments(name.value);

    return res.json({ comments });
  } catch (error) {
    console.error("Error al cargar los comentarios del actor:", error);

    return res.status(500).json({
      message: "No se pudieron cargar los comentarios del actor",
    });
  }
});

actorCommentsRouter.post("/:name/comments", async (req, res) => {
  try {
    const name = parseName(req.params.name);

    if ("error" in name) {
      return res.status(400).json({ message: name.error });
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

    // Solo actores de la agregación de Cinemeta: no se comenta
    // un actor que la fuente no entrega.
    const actor = await cinemetaService.findActorByName(name.value);

    if (!actor) {
      return res.status(404).json({
        message: "No encontramos ese actor",
      });
    }

    const comment = await createActorComment(
      actor.name,
      session.user.id,
      validated.text,
    );

    return res.status(201).json(comment);
  } catch (error) {
    console.error("Error al publicar el comentario del actor:", error);

    return res.status(500).json({
      message: "No se pudo publicar el comentario del actor",
    });
  }
});

/** Nombre de actor de la ruta: obligatorio y con tope (como `/actor`). */
function parseName(raw: string): { value: string } | { error: string } {
  const name = raw.trim();

  if (!name) {
    return { error: "El nombre del actor es requerido" };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return { error: `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres` };
  }

  return { value: name };
}
