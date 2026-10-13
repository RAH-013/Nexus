import { Router } from "express";
import { auth } from "../lib/auth";
import { ItemType } from "../generated/prisma/enums";
import {
  listReactions,
  setReaction,
  REACTION_KINDS,
  type ReactionKind,
} from "../services/reactions";
import { toWebHeaders } from "./comments";

export const reactionsRouter = Router();

const MAX_ID_LENGTH = 80;

const SUCCESS_MESSAGES: Record<ReactionKind, { on: string; off: string }> = {
  favorite: { on: "Añadido a favoritos", off: "Quitado de favoritos" },
  like: { on: "Marcado como me gusta", off: "Me gusta desmarcado" },
  dislike: { on: "Marcado como no me gusta", off: "No me gusta desmarcado" },
};

/** Títulos (favoritos, me gusta y no me gusta) del usuario en sesión. */
reactionsRouter.get("/", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: toWebHeaders(req) });

    if (!session) {
      return res.status(401).json({
        message: "Inicia sesión para ver tus reacciones",
      });
    }

    const reactions = await listReactions(session.user.id);

    return res.json(reactions);
  } catch (error) {
    console.error("Error al cargar las reacciones:", error);

    return res.status(500).json({
      message: "No se pudieron cargar tus reacciones",
    });
  }
});

reactionsRouter.put("/:kind/:type/:id", async (req, res) =>
  applyReaction(req, res, true),
);

reactionsRouter.delete("/:kind/:type/:id", async (req, res) =>
  applyReaction(req, res, false),
);

/** PUT (on) o DELETE (off) de una reacción. El `kind`/`type` se validan antes de todo. */
async function applyReaction(
  req: import("express").Request,
  res: import("express").Response,
  on: boolean,
) {
  const params = parseReactionParams(req.params);

  if ("status" in params) {
    return res.status(params.status).json({ message: params.message });
  }

  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({
      message: "Inicia sesión para reaccionar a títulos",
    });
  }

  try {
    await setReaction(session.user.id, params.kind, params.type, params.id, on);

    return res.json({
      message: SUCCESS_MESSAGES[params.kind][on ? "on" : "off"],
    });
  } catch (error) {
    console.error("Error al guardar la reacción:", error);

    return res.status(500).json({
      message: "No se pudo guardar la reacción",
    });
  }
}

interface ReactionParams {
  kind: ReactionKind;
  type: ItemType;
  id: string;
}

interface ParamError {
  status: number;
  message: string;
}

function parseReactionParams(params: {
  kind?: string;
  type?: string;
  id?: string;
}): ReactionParams | ParamError {
  const kind = REACTION_KINDS.find((value) => value === params.kind);

  if (!kind) {
    return { status: 400, message: "Tipo de reacción no válido" };
  }

  const type =
    params.type === "movie"
      ? ItemType.MOVIE
      : params.type === "series"
        ? ItemType.SERIES
        : undefined;

  if (!type) {
    return { status: 400, message: "Tipo de título no válido" };
  }

  if (!params.id?.trim()) {
    return { status: 400, message: "El ID es requerido" };
  }

  if (params.id.length > MAX_ID_LENGTH) {
    return {
      status: 400,
      message: `El ID no puede superar ${MAX_ID_LENGTH} caracteres`,
    };
  }

  return { kind, type, id: params.id };
}
