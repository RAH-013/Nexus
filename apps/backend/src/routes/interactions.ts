import { Router } from "express";
import { ItemType } from "../generated/prisma/enums";
import { auth } from "../lib/auth";
import {
  getRatingById,
  getUserRating,
  listNotInterested,
  listUserRatings,
  recordDetailView,
  recordImpressionBatch,
  setNotInterested,
  setUserRating,
} from "../services/interactions";
import { toWebHeaders } from "./comments";

export const interactionsRouter = Router();

const MAX_ID_LENGTH = 80;

function parseMediaType(raw?: string): ItemType | null {
  if (raw === "movie") return ItemType.MOVIE;
  if (raw === "series") return ItemType.SERIES;
  return null;
}

/**
 * Registra apertura de la ficha técnica de un título (DETAIL_VIEW).
 */
interactionsRouter.post("/detail/:type/:id", async (req, res) => {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({ message: "Inicia sesión para registrar interacciones" });
  }

  const type = parseMediaType(req.params.type);
  const id = req.params.id?.trim();

  if (!type || !id || id.length > MAX_ID_LENGTH) {
    return res.status(400).json({ message: "Parámetros de título inválidos" });
  }

  try {
    await recordDetailView(session.user.id, type, id);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Error al registrar visualización de detalle:", error);
    return res.status(500).json({ message: "No se pudo registrar la interacción" });
  }
});

/**
 * Registra un lote de impresiones (apariciones en recomendaciones).
 */
interactionsRouter.post("/impression", async (req, res) => {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({ message: "Inicia sesión para registrar impresiones" });
  }

  const rawItems = req.body?.items;
  if (!Array.isArray(rawItems)) {
    return res.status(400).json({ message: "El cuerpo debe contener un array 'items'" });
  }

  const items: { type: ItemType; externalId: string }[] = [];
  for (const raw of rawItems) {
    const type = parseMediaType(raw.type);
    const externalId = typeof raw.id === "string" ? raw.id.trim() : typeof raw.externalId === "string" ? raw.externalId.trim() : "";
    if (type && externalId && externalId.length <= MAX_ID_LENGTH) {
      items.push({ type, externalId });
    }
  }

  try {
    await recordImpressionBatch(session.user.id, items);
    return res.json({ ok: true, count: items.length });
  } catch (error) {
    console.error("Error al registrar impresiones:", error);
    return res.status(500).json({ message: "No se pudieron registrar las impresiones" });
  }
});

/**
 * Obtiene o actualiza la calificación del usuario para un título (1 a 5 estrellas).
 */
interactionsRouter.get("/rating/:type/:id", async (req, res) => {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({ message: "Inicia sesión para consultar calificaciones" });
  }

  const id = req.params.id?.trim();
  if (!id || id.length > MAX_ID_LENGTH) {
    return res.status(400).json({ message: "ID no válido" });
  }

  try {
    const rating = await getUserRating(session.user.id, id);
    return res.json({ rating });
  } catch (error) {
    console.error("Error al obtener calificación:", error);
    return res.status(500).json({ message: "No se pudo obtener la calificación" });
  }
});

interactionsRouter.put("/rating/:type/:id", async (req, res) => {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({ message: "Inicia sesión para calificar títulos" });
  }

  const type = parseMediaType(req.params.type);
  const id = req.params.id?.trim();
  const rating = Number(req.body?.rating);

  if (!type || !id || id.length > MAX_ID_LENGTH) {
    return res.status(400).json({ message: "Parámetros de título inválidos" });
  }

  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    return res.status(400).json({ message: "La calificación debe ser un valor entre 1 y 5 (o 0 para borrar)" });
  }

  try {
    await setUserRating(session.user.id, type, id, rating);
    return res.json({ message: rating > 0 ? "Calificación guardada" : "Calificación eliminada", rating });
  } catch (error) {
    console.error("Error al guardar calificación:", error);
    return res.status(500).json({ message: "No se pudo guardar la calificación" });
  }
});

/**
 * Lista todas las calificaciones del usuario { [externalId]: number }.
 */
interactionsRouter.get("/ratings", async (req, res) => {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({ message: "Inicia sesión para consultar tus calificaciones" });
  }

  try {
    const ratings = await listUserRatings(session.user.id);
    return res.json(ratings);
  } catch (error) {
    console.error("Error al listar calificaciones:", error);
    return res.status(500).json({ message: "No se pudieron obtener las calificaciones" });
  }
});

/** Cuerpo de POST /ratings: el mismo que usa PUT /rating/:type/:id. */
function parseRatingBody(body: { type?: unknown; id?: unknown; rating?: unknown } | undefined):
  | { type: ItemType; id: string; rating: number }
  | { message: string } {
  const type = parseMediaType(
    typeof body?.type === "string" ? body.type : undefined,
  );
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const rating = Number(body?.rating);

  if (!type || !id || id.length > MAX_ID_LENGTH) {
    return { message: "Parámetros de título inválidos" };
  }

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { message: "La calificación debe ser un valor entre 1 y 5" };
  }

  return { type, id, rating };
}

/**
 * Crea (o sustituye) la calificación de la sesión y regresa el recurso con su id.
 * Es la versión «alta» de la colección: la lectura por id es GET /ratings/:ratingId.
 */
interactionsRouter.post("/ratings", async (req, res) => {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({ message: "Inicia sesión para calificar títulos" });
  }

  const datos = parseRatingBody(req.body);

  if ("message" in datos) {
    return res.status(400).json({ message: datos.message });
  }

  try {
    const ratingId = await setUserRating(
      session.user.id,
      datos.type,
      datos.id,
      datos.rating,
    );

    if (ratingId === null) {
      return res.status(400).json({ message: "La calificación debe ser un valor entre 1 y 5" });
    }

    return res.status(201).json({
      id: ratingId,
      type: datos.type === ItemType.MOVIE ? "movie" : "series",
      externalId: datos.id,
      rating: datos.rating,
    });
  } catch (error) {
    console.error("Error al crear la calificación:", error);
    return res.status(500).json({ message: "No se pudo guardar la calificación" });
  }
});

/**
 * Calificación por su id: solo la puede leer quien la hizo.
 * Para los demás usuarios no existe (403), igual que el resto de recursos privados.
 */
interactionsRouter.get("/ratings/:ratingId", async (req, res) => {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({ message: "Inicia sesión para consultar tus calificaciones" });
  }

  const raw = req.params.ratingId;
  const ratingId = Number(raw);

  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(ratingId) || ratingId < 1) {
    return res.status(404).json({ message: "Calificación no encontrada" });
  }

  try {
    const rating = await getRatingById(ratingId);

    if (!rating) {
      return res.status(404).json({ message: "Calificación no encontrada" });
    }

    if (rating.userId !== session.user.id) {
      return res.status(403).json({ message: "Solo puedes ver tus calificaciones" });
    }

    return res.json({
      id: rating.id,
      type: rating.type === ItemType.MOVIE ? "movie" : "series",
      externalId: rating.externalId,
      rating: rating.rating,
    });
  } catch (error) {
    console.error("Error al cargar la calificación:", error);
    return res.status(500).json({ message: "No se pudo cargar la calificación" });
  }
});

/**
 * Gestión de contenidos descartados: «No me interesa».
 */
interactionsRouter.get("/not-interested", async (req, res) => {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({ message: "Inicia sesión para consultar títulos descartados" });
  }

  try {
    const list = await listNotInterested(session.user.id);
    return res.json({ notInterested: list });
  } catch (error) {
    console.error("Error al listar descartados:", error);
    return res.status(500).json({ message: "No se pudieron obtener los títulos descartados" });
  }
});

interactionsRouter.put("/not-interested/:type/:id", async (req, res) => {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({ message: "Inicia sesión para indicar que no te interesa un título" });
  }

  const type = parseMediaType(req.params.type);
  const id = req.params.id?.trim();

  if (!type || !id || id.length > MAX_ID_LENGTH) {
    return res.status(400).json({ message: "Parámetros inválidos" });
  }

  try {
    await setNotInterested(session.user.id, type, id, true);
    return res.json({ message: "Título descartado. No te recomendaremos títulos similares" });
  } catch (error) {
    console.error("Error al descartar título:", error);
    return res.status(500).json({ message: "No se pudo descartar el título" });
  }
});

interactionsRouter.delete("/not-interested/:type/:id", async (req, res) => {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return res.status(401).json({ message: "Inicia sesión para actualizar tus descartados" });
  }

  const type = parseMediaType(req.params.type);
  const id = req.params.id?.trim();

  if (!type || !id || id.length > MAX_ID_LENGTH) {
    return res.status(400).json({ message: "Parámetros inválidos" });
  }

  try {
    await setNotInterested(session.user.id, type, id, false);
    return res.json({ message: "Descarte eliminado" });
  } catch (error) {
    console.error("Error al quitar descarte:", error);
    return res.status(500).json({ message: "No se pudo actualizar el descarte" });
  }
});
