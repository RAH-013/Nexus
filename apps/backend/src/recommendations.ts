import { db, getDatabaseRuntime } from "./prisma/db.ts";

export type ActionType = "VIEW" | "LIKE" | "DISLIKE" | "RATING" | "FAVORITE" | "SEARCH";
export type ItemType = "MOVIE" | "SERIES";
export type UserActionInput = { userId: string; itemId: number | null; type: ActionType; value: number | null; searchQuery: string | null };

type Item = { id: number; title: string; description: string | null; type: ItemType; releaseYear: number | null };
type ItemCategory = { itemId: number; categoryId: number };
type UserAction = Pick<UserActionInput, "itemId" | "type" | "value">;
type Preference = { categoryId: number; weight: number };

/** A transparent, deployable content-based baseline for personalized results. */
export async function getRecommendations(userId: string, limit: number) {
  const runtime = await getDatabaseRuntime();
  const [items, itemCategories, actions, preferences] = await Promise.all([
    runtime.query(table("Item").select("id", "title", "description", "type", "releaseYear").build()) as Promise<Item[]>,
    runtime.query(table("ItemCategory").select("itemId", "categoryId").build()) as Promise<ItemCategory[]>,
    runtime.query(table("UserAction").select("itemId", "type", "value").where((f: any, fn: any) => fn.eq(f.userId, userId)).build()) as Promise<UserAction[]>,
    runtime.query(table("UserPreference").select("categoryId", "weight").where((f: any, fn: any) => fn.eq(f.userId, userId)).build()) as Promise<Preference[]>,
  ]);
  const categoriesByItem = new Map<number, number[]>();
  for (const relation of itemCategories) categoriesByItem.set(relation.itemId, [...(categoriesByItem.get(relation.itemId) ?? []), relation.categoryId]);
  const affinity = new Map<number, number>();
  for (const preference of preferences) add(affinity, preference.categoryId, preference.weight);
  const interacted = new Set<number>();
  for (const action of actions) {
    if (action.itemId === null) continue;
    interacted.add(action.itemId);
    for (const categoryId of categoriesByItem.get(action.itemId) ?? []) add(affinity, categoryId, actionWeight(action));
  }
  const recommendations = items.filter((item) => !interacted.has(item.id)).map((item) => ({
    ...item,
    score: round((categoriesByItem.get(item.id) ?? []).reduce((total, categoryId) => total + (affinity.get(categoryId) ?? 0), 0)),
  })).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit).map((item, index) => ({ position: index + 1, ...item }));
  return { algorithm: "content-based-action-weighting-v1", userId, generatedAt: new Date().toISOString(), recommendations };
}

function actionWeight(action: UserAction): number {
  switch (action.type) {
    case "FAVORITE": return 4;
    case "LIKE": return 3;
    case "VIEW": return 0.5;
    case "DISLIKE": return -4;
    case "RATING": return Math.max(-2, Math.min(2, (action.value ?? 3) - 3));
    case "SEARCH": return 0;
  }
}
function add(values: Map<number, number>, key: number, amount: number) { values.set(key, (values.get(key) ?? 0) + amount); }
function round(value: number) { return Math.round(value * 100) / 100; }
function table(name: "Item" | "ItemCategory" | "UserAction" | "UserPreference") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.sql.public as Record<string, any>)[name];
}
