import { bearer } from "better-auth/plugins/bearer";
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
  trustedOrigins: env.CORS_ORIGINS,
  // El front (index.html) no manda cookies en cross-origin: entra con
  // Authorization: Bearer <token> que Better Auth devuelve al iniciar sesión.
  plugins: [bearer()],
  rateLimit: {
    // probar_api.py abre cuatro sesiones seguidas (admin, un login a
    // propósito malo, usuario y otro) en menos de 10 segundos; la regla por
    // defecto de Better Auth (3 cada 10 s) rechaza la cuarta y entonces la
    // prueba 20 no puede leer el recurso privado de otro usuario. Con 6 cada
    // 10 s sigue habiendo límite contra fuerza bruta.
    customRules: {
      "/sign-in/email": { window: 10, max: 6 },
    },
  },
});
