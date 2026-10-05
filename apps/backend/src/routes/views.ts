import { Router } from "express";
import { auth } from "../lib/auth";
import {
  listWatchedMovieIds,
  markMovieViewed,
  unmarkMovieViewed,
} from "../services/views";

export const viewsRouter = Router();

const MAX_ID_LENGTH = 80;

/** Películas con `VIEW` del usuario en sesión (spec 003, D1). */
viewsRouter.get("/", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: toWebHeaders(req) });

    if (!session) {
      return res.status(401).json({
        message: "Inicia sesión para ver las películas que has marcado",
      });
    }

    const ids = await listWatchedMovieIds(session.user.id);

    return res.json({ ids });
  } catch (error) {
    console.error("Error al cargar las películas vistas:", error);

    return res.status(500).json({
      message: "No se pudieron cargar las películas vistas",
    });
  }
});

viewsRouter.put("/movie/:id", async (req, res) => {
  try {
    const id = parseTitleId(req.params.id);

    if ("error" in id) {
      return res.status(400).json({ message: id.error });
    }

    const session = await auth.api.getSession({ headers: toWebHeaders(req) });

    if (!session) {
      return res.status(401).json({
        message: "Inicia sesión para marcar películas como vistas",
      });
    }

    await markMovieViewed(session.user.id, id.value);

    return res.json({ message: "Película marcada como vista" });
  } catch (error) {
    console.error("Error al marcar la película como vista:", error);

    return res.status(500).json({
      message: "No se pudo marcar la película como vista",
    });
  }
});

viewsRouter.delete("/movie/:id", async (req, res) => {
  try {
    const id = parseTitleId(req.params.id);

    if ("error" in id) {
      return res.status(400).json({ message: id.error });
    }

    const session = await auth.api.getSession({ headers: toWebHeaders(req) });

    if (!session) {
      return res.status(401).json({
        message: "Inicia sesión para marcar películas como vistas",
      });
    }

    await unmarkMovieViewed(session.user.id, id.value);

    return res.json({ message: "Película desmarcada" });
  } catch (error) {
    console.error("Error al desmarcar la película:", error);

    return res.status(500).json({
      message: "No se pudo desmarcar la película",
    });
  }
});

/** Mismas reglas de id que comentarios (spec 003, D1: no vacío, ≤80). */
function parseTitleId(id: string): { value: string } | { error: string } {
  if (!id.trim()) {
    return { error: "El ID es requerido" };
  }

  if (id.length > MAX_ID_LENGTH) {
    return { error: `El ID no puede superar ${MAX_ID_LENGTH} caracteres` };
  }

  return { value: id };
}

/** Convierte los headers de Express en `Headers` de web (igual que routes/comments.ts). */
function toWebHeaders(req: import("express").Request): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
  }

  return headers;
}