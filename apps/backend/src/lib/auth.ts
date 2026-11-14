import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
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
  // Permite `Authorization: Bearer <token de sesión>` además de la cookie.
  // Lo usa el arnés de pruebas de la U3S5 (probar_ia.py) para autenticarse.
  plugins: [bearer()],
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
