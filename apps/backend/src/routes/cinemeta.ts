import { Router } from "express";
import {
  cinemetaService,
  isCatalogList,
  isCollection,
  isMovieList,
  isSearchType,
} from "../services/cinemeta";
import { profileImageUrl, tmdbService } from "../services/tmdb";

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

    const limit = parseSearchLimit(req.query.limit);

    if ("error" in limit) {
      return res.status(400).json({ message: limit.error });
    }

    const results = await cinemetaService.search(type, query, limit.value);

    return res.json(results);
  } catch (error) {
    console.error("Error al buscar en Cinemeta:", error);

    return res.status(502).json({
      message: "No se pudo realizar la búsqueda",
    });
  }
});

// Ruta de un solo tramo: no colisiona con /:type/:id (necesita dos).
cinemetaRouter.get("/actors", async (_req, res) => {
  try {
    const actors = await cinemetaService.getActors();

    return res.json({ actors });
  } catch (error) {
    console.error("Error al cargar los actores de Cinemeta:", error);

    return res.status(502).json({
      message: "No se pudieron cargar los actores",
    });
  }
});

// Ficha de un actor (foto y biografía de TMDB), también de un solo tramo.
cinemetaRouter.get("/actor", async (req, res) => {
  try {
    const name = String(req.query.name ?? "").trim();

    if (!name) {
      return res.status(400).json({
        message: "El parámetro name es requerido",
      });
    }

    if (name.length > 80) {
      return res.status(400).json({
        message: "El nombre no puede superar 80 caracteres",
      });
    }

    // Solo actores de la agregación de Cinemeta: TMDB enriquece, no aporta actores.
    const actor = await cinemetaService.findActorByName(name);

    if (!actor) {
      return res.status(404).json({
        message: "No encontramos ese actor",
      });
    }

    const person = await tmdbService.findPerson(actor.name);

    return res.json({
      actor: {
        ...actor,
        ...(person?.profilePath
          ? { imageUrl: profileImageUrl(person.profilePath) }
          : {}),
        ...(person?.biography ? { biography: person.biography } : {}),
      },
    });
  } catch (error) {
    console.error("Error al obtener datos del actor en TMDB:", error);

    return res.status(502).json({
      message: "No se pudieron obtener los datos del actor",
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

// Antes de /:type/:id para que «movies» no se lea como tipo (spec 003, D1).
cinemetaRouter.get("/movies/:list", async (req, res) => {
  try {
    const list = String(req.params.list ?? "");

    if (!isMovieList(list)) {
      return res.status(400).json({
        message: "La lista indicada no es válida",
      });
    }

    const items = await cinemetaService.getMovieList(list);

    return res.json(items);
  } catch (error) {
    console.error("Error al cargar la lista de películas de Cinemeta:", error);

    return res.status(502).json({
      message: "No se pudo cargar la lista de películas",
    });
  }
});

// Antes de /:type/:id para que «series» no se lea como tipo. Como la ficha usa
// el tipo «series», un id tipo tt… se resuelve aquí mismo como detalle.
cinemetaRouter.get("/series/:list", async (req, res) => {
  try {
    const list = String(req.params.list ?? "");

    if (!isCatalogList(list)) {
      if (!/^tt\d+$/i.test(list)) {
        return res.status(400).json({
          message: "La lista indicada no es válida",
        });
      }

      const title = await cinemetaService.getTitle("series", list);

      if (!title) {
        return res.status(404).json({
          message: "No encontramos ese título",
        });
      }

      return res.json(title);
    }

    const items = await cinemetaService.getSeriesList(list);

    return res.json(items);
  } catch (error) {
    console.error("Error al obtener contenido de series de Cinemeta:", error);

    return res.status(502).json({
      message: "No se pudo cargar la lista de series",
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

/** `limit` opcional de la búsqueda: entero entre 1 y 50; ausente → tope por defecto (10). */
function parseSearchLimit(value: unknown): { value?: number } | { error: string } {
  if (value === undefined) {
    return {};
  }

  const parsed = Number(String(value));

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    return { error: "El parámetro limit debe ser un número entre 1 y 50" };
  }

  return { value: parsed };
}