import { z } from "zod";

const DEFAULT_CINEMETA_BASE_URL = "https://v3-cinemeta.strem.io";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  TZ: z.string().default("UTC"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // Opcional: URL base de la fuente de contenido (vacía o ausente = la real).
  CINEMETA_BASE_URL: z
    .union([z.url(), z.literal("")])
    .default(DEFAULT_CINEMETA_BASE_URL)
    .transform((value) => value || DEFAULT_CINEMETA_BASE_URL),
});

export const env = envSchema.parse(process.env);
