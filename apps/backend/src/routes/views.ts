import { Router } from "express";
import { auth } from "../lib/auth";
import {
  listWatchedIds,
  markMovieViewed,
  unmarkMovieViewed,
  markSeriesViewed,
  unmarkSeriesViewed,
} from "../services/views";

export const viewsRouter = Router();

const MAX_ID_LENGTH = 80;

/** Títulos (Películas y Series) con `VIEW` del usuario en sesión. */
viewsRouter.get("/", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: toWebHeaders(req) });

    if (!session) {
      return res.status(401).json({
        message: "Inicia sesión para ver los títulos que has marcado",
      });
    }

    const ids = await listWatchedIds(session.user.id);

    return res.json({ ids });
  } catch (error) {
    console.error("Error al cargar los títulos vistos:", error);

    return res.status(500).json({
      message: "No se pudieron cargar los títulos vistos",
    });
  }
});

/* ================= PELÍCULAS ================= */

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

/* ================= SERIES ================= */

viewsRouter.put("/series/:id", async (req, res) => {
  try {
    const id = parseTitleId(req.params.id);

    if ("error" in id) {
      return res.status(400).json({ message: id.error });
    }

    const session = await auth.api.getSession({ headers: toWebHeaders(req) });

    if (!session) {
      return res.status(401).json({
        message: "Inicia sesión para marcar series como vistas",
      });
    }

    await markSeriesViewed(session.user.id, id.value);

    return res.json({ message: "Serie marcada como vista" });
  } catch (error) {
    console.error("Error al marcar la serie como vista:", error);

    return res.status(500).json({
      message: "No se pudo marcar la serie como vista",
    });
  }
});

viewsRouter.delete("/series/:id", async (req, res) => {
  try {
    const id = parseTitleId(req.params.id);

    if ("error" in id) {
      return res.status(400).json({ message: id.error });
    }

    const session = await auth.api.getSession({ headers: toWebHeaders(req) });

    if (!session) {
      return res.status(401).json({
        message: "Inicia sesión para marcar series como vistas",
      });
    }

    await unmarkSeriesViewed(session.user.id, id.value);

    return res.json({ message: "Serie desmarcada" });
  } catch (error) {
    console.error("Error al desmarcar la serie:", error);

    return res.status(500).json({
      message: "No se pudo desmarcar la serie",
    });
  }
});

/** Mismas reglas de id que comentarios (no vacío, ≤80). */
function parseTitleId(id: string): { value: string } | { error: string } {
  if (!id.trim()) {
    return { error: "El ID es requerido" };
  }

  if (id.length > MAX_ID_LENGTH) {
    return { error: `El ID no puede superar ${MAX_ID_LENGTH} caracteres` };
  }

  return { value: id };
}

/** Convierte los headers de Express en `Headers` de web. */
function toWebHeaders(req: import("express").Request): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
  }

  return headers;
}