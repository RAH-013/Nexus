import { Router } from "express";
import { auth } from "../lib/auth";
import { getForYou } from "../services/forYou";
import { toWebHeaders } from "./comments";

export const recommendationsRouter = Router();

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
