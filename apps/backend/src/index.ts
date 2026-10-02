import express, { type NextFunction, type Request, type Response } from "express";

import { db, connectDatabase, getDatabaseRuntime } from "./prisma/db.ts";
import { getRecommendations, type ActionType, type ItemType, type UserActionInput } from "./recommendations.ts";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const actionTypes = new Set<ActionType>(["VIEW", "LIKE", "DISLIKE", "RATING", "FAVORITE", "SEARCH"]);
const itemTypes = new Set<ItemType>(["MOVIE", "SERIES"]);

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api", (_req, res) => res.json({
  name: "Nexus API", version: "1.0.0",
  endpoints: ["GET /api/health/live", "GET /api/health/ready", "GET, POST /api/items", "GET /api/categories", "POST /api/actions", "GET /api/recommendations/:userId"],
}));

// Liveness checks only the process; readiness also verifies the database.
app.get("/api/health/live", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/api/health/ready", async (_req, res) => {
  try {
    await connectDatabase();
    res.status(200).json({ status: "ready", database: "connected" });
  } catch (error) {
    console.error("Database readiness check failed", error);
    res.status(503).json({ status: "not_ready", database: "unavailable" });
  }
});

app.get("/api/items", async (req, res, next) => {
  try {
    const type = optionalItemType(req.query.type);
    const limit = positiveInteger(req.query.limit, 50, 100);
    const runtime = await getDatabaseRuntime();
    const [items, categories, itemCategories] = await Promise.all([
      runtime.query(
      table("Item").select("id", "title", "description", "type", "releaseYear").orderBy("title", { direction: "asc" }).limit(limit).build(),
      ),
      runtime.query(table("Category").select("id", "name").build()),
      runtime.query(table("ItemCategory").select("itemId", "categoryId").build()),
    ]);
    const categoryNames = new Map(categories.map((category: { id: number; name: string }) => [category.id, category.name]));
    const categoriesByItem = new Map<number, string[]>();
    for (const relation of itemCategories as Array<{ itemId: number; categoryId: number }>) {
      const name = categoryNames.get(relation.categoryId);
      if (name) categoriesByItem.set(relation.itemId, [...(categoriesByItem.get(relation.itemId) ?? []), name]);
    }
    const visibleItems = type ? items.filter((item: { type: ItemType }) => item.type === type) : items;
    res.json({ items: visibleItems.map((item: { id: number }) => ({ ...item, categories: categoriesByItem.get(item.id) ?? [] })) });
  } catch (error) { next(error); }
});

app.post("/api/items", async (req, res, next) => {
  try {
    const title = nonEmptyString(req.body?.title, "title");
    const type = requiredItemType(req.body?.type);
    const description = optionalString(req.body?.description, "description");
    const releaseYear = optionalYear(req.body?.releaseYear);
    const [item] = await (await getDatabaseRuntime()).query(
      table("Item").insert([{ title, type, description, releaseYear }]).returning("id", "title", "description", "type", "releaseYear", "createdAt").build(),
    );
    res.status(201).json({ item });
  } catch (error) { next(error); }
});

app.get("/api/categories", async (_req, res, next) => {
  try {
    const categories = await (await getDatabaseRuntime()).query(
      table("Category").select("id", "name").orderBy("name", { direction: "asc" }).build(),
    );
    res.json({ categories });
  } catch (error) { next(error); }
});

app.post("/api/actions", async (req, res, next) => {
  try {
    const action = parseAction(req.body);
    const [recordedAction] = await (await getDatabaseRuntime()).query(
      table("UserAction").insert([action]).returning("id", "userId", "itemId", "type", "value", "searchQuery", "createdAt").build(),
    );
    res.status(201).json({ action: recordedAction });
  } catch (error) { next(error); }
});

app.get("/api/recommendations/:userId", async (req, res, next) => {
  try {
    const userId = nonEmptyString(req.params.userId, "userId");
    res.json(await getRecommendations(userId, positiveInteger(req.query.limit, 12, 50)));
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const clientError = message.startsWith("Invalid ") || message.endsWith(" is required");
  if (!clientError) console.error(error);
  res.status(clientError ? 400 : 500).json({ error: message });
});

app.listen(port, () => console.log(`Nexus API listening on port ${port}`));

function table(name: "Item" | "Category" | "ItemCategory" | "UserAction") {
  // The generated Prisma contract supplies these table builders at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.sql.public as Record<string, any>)[name];
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}
function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`Invalid ${field}`);
  return value.trim();
}
function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) throw new Error("Invalid limit");
  return parsed;
}
function optionalYear(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1888 || year > 2100) throw new Error("Invalid releaseYear");
  return year;
}
function requiredItemType(value: unknown): ItemType {
  if (typeof value !== "string" || !itemTypes.has(value as ItemType)) throw new Error("Invalid type");
  return value as ItemType;
}
function optionalItemType(value: unknown): ItemType | undefined {
  return value === undefined ? undefined : requiredItemType(value);
}
function parseAction(body: unknown): UserActionInput {
  if (!body || typeof body !== "object") throw new Error("Invalid action body");
  const input = body as Record<string, unknown>;
  if (typeof input.type !== "string" || !actionTypes.has(input.type as ActionType)) throw new Error("Invalid type");
  const itemId = input.itemId === undefined || input.itemId === null ? null : Number(input.itemId);
  const value = input.value === undefined || input.value === null ? null : Number(input.value);
  const searchQuery = optionalString(input.searchQuery, "searchQuery");
  if (itemId !== null && (!Number.isInteger(itemId) || itemId < 1)) throw new Error("Invalid itemId");
  if (value !== null && !Number.isFinite(value)) throw new Error("Invalid value");
  if (input.type === "SEARCH" && !searchQuery) throw new Error("searchQuery is required");
  if (input.type !== "SEARCH" && itemId === null) throw new Error("itemId is required");
  return { userId: nonEmptyString(input.userId, "userId"), itemId, type: input.type as ActionType, value, searchQuery };
}
