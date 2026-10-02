import postgres from "@prisma/orm-postgres/runtime";

import "temporal-polyfill/global";

import service from "../../service.ts";
import type { Contract } from "./contract.d.ts";
import contractJson from "./contract.json" with { type: "json" };

function loadComposerDatabase() {
  try {
    return service.load().database.client;
  } catch {
    return undefined;
  }
}

export const db =
  loadComposerDatabase() ??
  (process.env.DATABASE_URL
    ? postgres<Contract>({ contractJson, url: process.env.DATABASE_URL })
    : postgres<Contract>({ contractJson }));

let connection: ReturnType<typeof db.connect> | undefined;

export function getDatabaseRuntime() {
  connection ??= db.connect();
  return connection;
}

export function connectDatabase(): Promise<void> {
  return getDatabaseRuntime().then(() => undefined).catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
}
