import { Router } from "express";
import { cinemetaService, isCollection, isSearchType } from "../services/cinemeta";

export const cinemetaRouter = Router();

cinemetaRouter.get("/search", async (req, res) => {
  try {
    const type = req.query.type === undefined ? "all" : String(req.query.type);
    const query = String(req.query.q ?? "").trim();

    if (!isSearchType(type)) {
      return res.status(400).json({
        message: "El tipo debe ser movie, series o all",
      });
    }

    if (!query) {
      return res.status(400).json({
        message: "El parámetro q es requerido",
      });
    }

    if (query.length > 80) {
      return res.status(400).json({
        message: "La búsqueda no puede superar 80 caracteres",
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

cinemetaRouter.get("/catalog/:collection", async (req, res) => {
  try {
    const collection = String(req.params.collection ?? "");

    if (!isCollection(collection)) {
      return res.status(400).json({
        message: "La colección indicada no es válida",
      });
    }

    const items = await cinemetaService.getCollection(collection);

    return res.json(items);
  } catch (error) {
    console.error("Error al cargar la colección de Cinemeta:", error);

    return res.status(502).json({
      message: "No se pudo cargar la colección",
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

    const title = await cinemetaService.getTitle(type, id);

    if (!title) {
      return res.status(404).json({
        message: "No encontramos ese título",
      });
    }

    return res.json(title);
  } catch (error) {
    console.error("Error al obtener contenido de Cinemeta:", error);

    return res.status(502).json({
      message: "No se pudo obtener el contenido",
    });
  }
});
