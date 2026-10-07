import { Router } from "express";
import { auth } from "../lib/auth";
import {
  decodeCursor,
  listRecentActorComments,
  listRecentComments,
  listRecentViews,
  type ActivityCursor,
  type ActivityOrder,
} from "../services/activity";
import { toWebHeaders } from "./comments";

export const activityRouter = Router();

/** Tamaño de página por defecto; el cliente puede pedir hasta 50. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Primer valor de un parámetro de query (puede llegar como array). */
function queryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

/** Orden: `desc` (por defecto) o `asc`. */
function parseOrder(
  raw: string | undefined,
): { value: ActivityOrder } | { error: string } {
  if (raw === undefined || raw === "desc") {
    return { value: "desc" };
  }

  return raw === "asc"
    ? { value: "asc" }
    : { error: "El orden debe ser «desc» o «asc»" };
}

/** Límite de la página: entero de 1 a 50. */
function parseLimit(
  raw: string | undefined,
): { value: number } | { error: string } {
  if (raw === undefined) {
    return { value: DEFAULT_LIMIT };
  }

  const limit = Number(raw);

  return Number.isInteger(limit) && limit >= 1 && limit <= MAX_LIMIT
    ? { value: limit }
    : { error: `El límite debe ser un número entero de 1 a ${MAX_LIMIT}` };
}

/** Cursor opaco de la página anterior. */
function parseCursor(
  raw: string | undefined,
): { value: ActivityCursor | null } | { error: string } {
  if (raw === undefined) {
    return { value: null };
  }

  const cursor = decodeCursor(raw);

  return cursor ? { value: cursor } : { error: "El cursor no es válido" };
}

/** Parámetros que comparten las tres filas. */
interface ActivityParams {
  userId: string;
  order: ActivityOrder;
  limit: number;
  cursor: ActivityCursor | null;
}

/** Sesión obligatoria y los parámetros que comparten las tres filas. */
async function readParams(
  req: import("express").Request,
): Promise<ActivityParams | { message: string; status: number }> {
  const session = await auth.api.getSession({ headers: toWebHeaders(req) });

  if (!session) {
    return { message: "Inicia sesión para ver tu actividad", status: 401 };
  }

  const order = parseOrder(queryValue(req.query.order));

  if ("error" in order) {
    return { message: order.error, status: 400 };
  }

  const limit = parseLimit(queryValue(req.query.limit));

  if ("error" in limit) {
    return { message: limit.error, status: 400 };
  }

  const cursor = parseCursor(queryValue(req.query.cursor));

  if ("error" in cursor) {
    return { message: cursor.error, status: 400 };
  }

  return {
    userId: session.user.id,
    order: order.value,
    limit: limit.value,
    cursor: cursor.value,
  };
}

/* ================= FILA 1: VISTAS ================= */

activityRouter.get("/views", async (req, res) => {
  try {
    const parsed = await readParams(req);

    if ("message" in parsed) {
      return res.status(parsed.status).json({ message: parsed.message });
    }

    const page = await listRecentViews(
      parsed.userId,
      parsed.order,
      parsed.cursor,
      parsed.limit,
    );

    return res.json(page);
  } catch (error) {
    console.error("Error al cargar los títulos vistos:", error);

    return res.status(500).json({
      message: "No se pudieron cargar los títulos vistos",
    });
  }
});

/* ================= FILA 2: COMENTARIOS DE TÍTULOS ================= */

activityRouter.get("/comments", async (req, res) => {
  try {
    const parsed = await readParams(req);

    if ("message" in parsed) {
      return res.status(parsed.status).json({ message: parsed.message });
    }

    const page = await listRecentComments(
      parsed.userId,
      parsed.order,
      parsed.cursor,
      parsed.limit,
    );

    return res.json(page);
  } catch (error) {
    console.error("Error al cargar los comentarios:", error);

    return res.status(500).json({
      message: "No se pudieron cargar los comentarios",
    });
  }
});

/* ================= FILA 3: COMENTARIOS DE ACTORES ================= */

activityRouter.get("/actor-comments", async (req, res) => {
  try {
    const parsed = await readParams(req);

    if ("message" in parsed) {
      return res.status(parsed.status).json({ message: parsed.message });
    }

    const page = await listRecentActorComments(
      parsed.userId,
      parsed.order,
      parsed.cursor,
      parsed.limit,
    );

    return res.json(page);
  } catch (error) {
    console.error("Error al cargar los comentarios de actores:", error);

    return res.status(500).json({
      message: "No se pudieron cargar los comentarios de actores",
    });
  }
});