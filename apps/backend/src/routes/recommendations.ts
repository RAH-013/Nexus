import { Router } from "express";
import { auth } from "../lib/auth";
import { preguntarFicha } from "../services/gemini";
import { FallaExterna } from "../services/externo";
import { getForYou } from "../services/forYou";
import { toWebHeaders } from "./comments";

export const recommendationsRouter = Router();

/** Límites del título que se le manda a la IA (U3S5). */
const FICHA_TITULO_MIN = 2;
const FICHA_TITULO_MAX = 300;

/**
 * Recomendaciones «Para ti» (spec 004): sesión obligatoria; `?refresh=1`
 * invalida la caché de Redis y fuerza el recálculo.
 */
recommendationsRouter.get("/for-you", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: toWebHeaders(req) });

    if (!session) {
      return res.status(401).json({
        message: "Inicia sesión para ver tus recomendaciones",
      });
    }

    const result = await getForYou(session.user.id, req.query.refresh === "1");

    return res.json(result);
  } catch (error) {
    console.error("Error al cargar las recomendaciones:", error);

    return res.status(500).json({
      message: "No se pudieron cargar tus recomendaciones",
    });
  }
});

/**
 * Ficha de un título con IA (U3S5). La respuesta del modelo se valida antes
 * de devolverla; si la IA tarda, se cae o responde basura, se responde
 * 502/503/504 en JSON en lugar de dejar caer la petición con un 500.
 */
recommendationsRouter.post("/ficha", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: toWebHeaders(req) });

    if (!session) {
      return res.status(401).json({
        message: "Inicia sesión para consultar la IA",
      });
    }

    const body = req.body as { titulo?: unknown } | undefined;
    const titulo = typeof body?.titulo === "string" ? body.titulo.trim() : "";

    if (titulo.length < FICHA_TITULO_MIN || titulo.length > FICHA_TITULO_MAX) {
      return res.status(400).json({
        message: `El título debe tener entre ${FICHA_TITULO_MIN} y ${FICHA_TITULO_MAX} caracteres`,
      });
    }

    const ficha = await preguntarFicha(titulo);

    return res.json(ficha);
  } catch (error) {
    if (error instanceof FallaExterna) {
      return res.status(error.codigo).json({ message: error.message });
    }

    console.error("Error al generar la ficha con IA:", error);

    return res.status(500).json({
      message: "No se pudo generar la ficha del título",
    });
  }
});
