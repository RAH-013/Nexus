import { db } from "../prisma/db.ts";
import { DEMO_CATEGORIES, DEMO_ITEMS, DEMO_USER } from "./demo-data.ts";

async function main() {
  await db.transaction(async (tx) => {
    const categoryIds = new Map<string, number>();
    for (const name of DEMO_CATEGORIES) {
      const category = await tx.orm.public.Category.where({ name }).first()
        ?? await tx.orm.public.Category.create({ name });
      categoryIds.set(name, category.id);
    }

    const user = await tx.orm.public.User.first({ id: DEMO_USER.id })
      ?? await tx.orm.public.User.create(DEMO_USER);

    const itemIds = new Map<string, number>();
    for (const sample of DEMO_ITEMS) {
      const provider = await tx.orm.public.ItemProvider
        .where({ provider: "TMDB", externalId: sample.key })
        .first();
      const item = provider
        ? await tx.orm.public.Item.first({ id: provider.itemId })
        : await tx.orm.public.Item.create({
            title: sample.title,
            description: sample.description,
            type: sample.type,
            releaseYear: sample.releaseYear,
          });

      if (!item) throw new Error(`No se encontró el contenido demo ${sample.key}`);
      itemIds.set(sample.key, item.id);
      if (!provider) await tx.orm.public.ItemProvider.create({ itemId: item.id, provider: "TMDB", externalId: sample.key });

      for (const categoryName of sample.categories) {
        const categoryId = categoryIds.get(categoryName);
        if (!categoryId) throw new Error(`Falta la categoría ${categoryName}`);
        const linked = await tx.orm.public.ItemCategory.first({ itemId: item.id, categoryId });
        if (!linked) await tx.orm.public.ItemCategory.create({ itemId: item.id, categoryId });
      }
    }

    await tx.orm.public.UserPreference.where({ userId: user.id }).delete();
    for (const [categoryName, weight] of [["Ciencia ficción", 2], ["Misterio", 1.5], ["Aventura", 0.8]] as const) {
      await tx.orm.public.UserPreference.create({ userId: user.id, categoryId: categoryIds.get(categoryName)!, weight });
    }

    // Replacing only this demo user's actions keeps repeated runs deterministic.
    await tx.orm.public.UserAction.where({ userId: user.id }).delete();
    for (const [key, type, value] of [
      ["nexus-demo-arrival", "FAVORITE", null],
      ["nexus-demo-dune", "LIKE", null],
      ["nexus-demo-knives-out", "RATING", 4.5],
      ["nexus-demo-mandalorian", "VIEW", null],
    ] as const) {
      await tx.orm.public.UserAction.create({ userId: user.id, itemId: itemIds.get(key)!, type, value, searchQuery: null });
    }
  });

  console.log(`Seed lista. Consulta GET /api/recommendations/${DEMO_USER.id} para ver las recomendaciones.`);
}

try {
  await main();
} finally {
  await db.close();
}
