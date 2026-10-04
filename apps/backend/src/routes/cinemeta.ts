import { Router } from "express";
import { cinemetaService } from "../services/cinemeta";

export const cinemetaRouter = Router();

cinemetaRouter.get("/search", async (req, res) => {
  try {
    const type = req.query.type;
    const query = String(req.query.q ?? "").trim();

    if (type !== "movie" && type !== "series") {
      return res.status(400).json({
        message: "El tipo debe ser movie o series",
      });
    }

    if (!query) {
      return res.status(400).json({
        message: "El parámetro q es requerido",
      });
    }

    const results = await cinemetaService.search(type, query);

    return res.json(results);
  } catch (error) {
    console.error("Error al buscar en Cinemeta:", error);

    return res.status(502).json({
      message: "No se pudo realizar la búsqueda",
    });
  }
});

cinemetaRouter.get("/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type !== "movie" && type !== "series") {
      return res.status(400).json({
        message: "El tipo debe ser movie o series",
      });
    }

    if (!id.trim()) {
      return res.status(400).json({
        message: "El ID es requerido",
      });
    }

    const result =
      type === "movie"
        ? await cinemetaService.getMovie(id)
        : await cinemetaService.getSeries(id);

    return res.json(result);
  } catch (error) {
    console.error("Error al obtener contenido de Cinemeta:", error);

    return res.status(502).json({
      message: "No se pudo obtener el contenido",
    });
  }
});
