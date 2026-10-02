import { db, getDatabaseRuntime } from "../prisma/db.ts";
import { DEMO_ITEMS, DEMO_USER } from "./demo-data.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = (name: string) => (db.sql.public as Record<string, any>)[name];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eq = (field: string, value: unknown) => (f: any, fn: any) => fn.eq(f[field], value);

async function main() {
  const rt = await getDatabaseRuntime();

  const itemIds: number[] = [];
  for (const sample of DEMO_ITEMS) {
    const rows = await rt.query(
      t("ItemProvider").select("itemId")
        .where((f: any, fn: any) => fn.and(fn.eq(f.provider, "TMDB"), fn.eq(f.externalId, sample.key)))
        .limit(1).build()
    );
    if (rows[0]) itemIds.push(rows[0].itemId);
  }

  for (const itemId of itemIds) {
    await rt.query(t("RecommendationItem").delete().where(eq("itemId", itemId)).build());
    await rt.query(t("ItemCategory").delete().where(eq("itemId", itemId)).build());
    await rt.query(t("UserAction").delete().where(eq("itemId", itemId)).build());
    await rt.query(t("ItemProvider").delete().where(eq("itemId", itemId)).build());
    await rt.query(t("Item").delete().where(eq("id", itemId)).build());
  }

  await rt.query(t("UserAction").delete().where(eq("userId", DEMO_USER.id)).build());
  await rt.query(t("UserPreference").delete().where(eq("userId", DEMO_USER.id)).build());
  await rt.query(t("User").delete().where(eq("id", DEMO_USER.id)).build());

  console.log("Datos demo eliminados. Las categorías se conservan para no borrar taxonomía que ya use otro contenido.");
}

try {
  await main();
} finally {
  await db.close();
}
