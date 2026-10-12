import { z } from "zod";

const DEFAULT_CINEMETA_BASE_URL = "https://v3-cinemeta.strem.io";
const DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash"];

/** Lista por comas de modelos de Gemini, en orden de preferencia. */
const geminiModelsSchema = z
  .union([z.string().min(1), z.literal("")])
  .default(DEFAULT_GEMINI_MODELS.join(","))
  .transform((value) => {
    const models = value
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);

    return models.length > 0 ? models : DEFAULT_GEMINI_MODELS;
  });

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
  // Opcional: clave de la API de Gemini para las recomendaciones «Para ti».
  // Ausente o vacía = el motor usa la heurística local (spec 004, RF-10).
  GEMINI_API_KEY: z
    .union([z.string().min(1), z.literal("")])
    .default("")
    .transform((value) => value || undefined),
  // Opcional: URL base de la API de Gemini (vacía o ausente = la real).
  GEMINI_BASE_URL: z
    .union([z.url(), z.literal("")])
    .default("https://generativelanguage.googleapis.com")
    .transform((value) => value || "https://generativelanguage.googleapis.com"),
  // Opcional: modelos de Gemini para recomendaciones, en orden de preferencia
  // (separados por coma). Si uno agota su cuota gratis, el motor pasa al
  // siguiente; si se agotan todos, «Para ti» usa la heurística local (RF-10).
  GEMINI_MODELS: geminiModelsSchema,
});

export const env = envSchema.parse(process.env);
