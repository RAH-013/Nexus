import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "../db.ts";

export const auth = betterAuth({
  database: prismaAdapter(db.orm.public, {
    provider: "postgresql",
  }),
});
