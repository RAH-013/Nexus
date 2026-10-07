import { z } from "zod";

const DEFAULT_CINEMETA_BASE_URL = "https://v3-cinemeta.strem.io";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  TZ: z.string().default("UTC"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // Opcional: URL base de la fuente de contenido (vacía o ausente = la real).
  CINEMETA_BASE_URL: z
    .union([z.url(), z.literal("")])
    .default(DEFAULT_CINEMETA_BASE_URL)
    .transform((value) => value || DEFAULT_CINEMETA_BASE_URL),
  // Opcional: clave de TMDB para la foto y biografía de actores.
  // Ausente = la vista Actores se queda solo con los datos de Cinemeta.
  TMDB_API_KEY: z.string().min(1).optional(),
  // Opcional: URL base de la API de TMDB (vacía o ausente = la real).
  TMDB_BASE_URL: z
    .union([z.url(), z.literal("")])
    .default("https://api.themoviedb.org/3")
    .transform((value) => value || "https://api.themoviedb.org/3"),
});

export const env = envSchema.parse(process.env);
