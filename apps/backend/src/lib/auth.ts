import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { env } from "../config/env";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    "http://127.0.0.1",
    "http://127.0.0.1:80",
    "http://127.0.0.1:8080",
    "http://localhost",
    "http://localhost:80",
    "http://localhost:8080",
    "http://nexus.local",
    env.BETTER_AUTH_URL,
  ],
});
