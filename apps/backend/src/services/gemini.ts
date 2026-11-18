import { env } from "../config/env";
import { FallaExterna, llamarExterno } from "./externo";

/** Límite de la ficha «Para ti» (spec 004, RF-12). */
export const RECOMMENDATION_LIMIT = 10;

/** Motivo de cada recomendación: tope del RF-8 (razón ≤140 caracteres). */
const REASON_MAX_LENGTH = 140;

/** Un solo intento por modelo; el timeout es el criterio del resto del backend. */
const REQUEST_TIMEOUT_MS = 10_000;

const MAX_OUTPUT_TOKENS = 2048;

const TEMPERATURE = 0.3;

/**
 * URL del servicio externo para la ficha con IA. `EXTERNO_URL` (la variable
 * de la U3S5) tiene prioridad sobre `GEMINI_BASE_URL` para poder apuntar al
 * simulador de fallas sin cambiar el resto de la integración.
 */
const IA_URL = (env.EXTERNO_URL ?? env.GEMINI_BASE_URL).replace(/\/+$/, "");

/** Modelo de la ficha: el de `GEMINI_MODELO` o el primero de la lista. */
const IA_MODELO = env.GEMINI_MODELO ?? env.GEMINI_MODELS[0];

/** Topes de la ficha para no devolver textos enormes al frontend. */
const FICHA_GENERO_MAX_LENGTH = 80;
const FICHA_SINOPSIS_MAX_LENGTH = 800;

export type Sentiment = "positivo" | "negativo" | "neutro";

const SENTIMENTS: readonly Sentiment[] = ["positivo", "negativo", "neutro"];

/** Título del perfil tal como viaja al prompt (nombre si se pudo enriquecer). */
export interface PromptTitle {
  id: string;
  type: "movie" | "series";
  name?: string;
  year?: string;
  genres?: string[];
  createdAt?: Date;
}

/** Comentario propio del usuario que el modelo debe clasificar (RF-9). */
export interface PromptComment {
  id: number;
  fuente: "titulo" | "actor";
  text: string;
  actorName?: string;
  genres?: string[];
  sentiment?: Sentiment;
}

export interface UserProfile {
  format: "series" | "peliculas" | "mixto";
  watched: PromptTitle[];
  favorites: PromptTitle[];
  likes: PromptTitle[];
  dislikes: PromptTitle[];
  comments: PromptComment[];
  ratings?: { id: string; rating: number; genres?: string[]; createdAt?: Date }[];
  detailViews?: { id: string; count: number; genres?: string[]; createdAt?: Date }[];
  notInterested?: string[];
  preferredDirectors?: string[];
  preferredActors?: string[];
}

export interface Candidate {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  year?: string;
  genres?: string[];
  director?: string;
  cast?: string[];
}

export interface GeminiRecommendation {
  id: string;
  score: number;
  reason: string;
}

export interface CommentSentiment {
  id: number;
  fuente: "titulo" | "actor";
  sentiment: Sentiment;
}

export interface GeminiResult {
  recommendations: GeminiRecommendation[];
  /** `null` si el bloque de comentarios vino ausente o inválido (RF-9). */
  sentiments: CommentSentiment[] | null;
}

/** Ficha corta que la IA escribe para un título (U3S5). */
export interface Ficha {
  genero: string;
  sinopsis: string;
}

interface GeminiApiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

/** Clave ausente = integración desactivada: el motor cae en la heurística. */
export function geminiEnabled(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

/**
 * Una única llamada al modelo (grounded: el prompt solo admite estos candidatos).
 * `parseGeminiResponse` valida la respuesta; si un modelo falla o devuelve
 * JSON ilegible se intenta el siguiente de `GEMINI_MODELS` (RF-8) y, si se
 * agotan todos, se lanza el error para que el motor use la heurística (RF-10).
 */
export async function geminiRecommend(
  profile: UserProfile,
  candidates: Candidate[],
): Promise<GeminiResult> {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurada");
  }

  const prompt = buildPrompt(profile, candidates);
  let lastError: unknown;

  for (const model of env.GEMINI_MODELS) {
    try {
      const text = await generateContent(model, apiKey, prompt);

      return parseGeminiResponse(text, candidates);
    } catch (error) {
      lastError = error;
      console.warn(
        `Gemini (${model}) no respondió de forma útil, se prueba el siguiente modelo:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini no devolvió recomendaciones válidas");
}

async function generateContent(
  model: string,
  apiKey: string,
  prompt: string,
): Promise<string> {
  const url = `${env.GEMINI_BASE_URL}/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    // La clave viaja en el encabezado, fuera de la URL y de los logs (U3S5).
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        // Sin «thinking»: para ordenar y explicar candidatos no aporta
        // razonar y en free tier marca la diferencia de latencia.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const data = (await response.json()) as GeminiApiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini no devolvió texto");
  }

  return text;
}

/**
 * Valida la respuesta del modelo contra los candidatos reales (RF-8):
 * ids fuera de la lista o repetidos → descartados; score → 0-100; reason →
 * ≤140 caracteres. El bloque de comentarios es tolerante: si viene mal se
 * ignora sin perder las recomendaciones (RF-9).
 */
export function parseGeminiResponse(
  text: string,
  candidates: Candidate[],
): GeminiResult {
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Gemini devolvió JSON ilegible");
  }

  const raw = data as {
    recomendaciones?: unknown;
    recommendations?: unknown;
    comentarios?: unknown;
  };

  const entries = Array.isArray(raw.recomendaciones)
    ? raw.recomendaciones
    : Array.isArray(raw.recommendations)
      ? raw.recommendations
      : undefined;

  if (!entries) {
    throw new Error("Gemini no devolvió la lista de recomendaciones");
  }

  const knownIds = new Set(candidates.map((candidate) => candidate.id));
  const usedIds = new Set<string>();
  const recommendations: GeminiRecommendation[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const { id, score, reason } = entry as {
      id?: unknown;
      score?: unknown;
      reason?: unknown;
    };

    if (typeof id !== "string" || !knownIds.has(id) || usedIds.has(id)) {
      continue;
    }

    usedIds.add(id);
    recommendations.push({
      id,
      score: clampScore(score),
      reason:
        typeof reason === "string"
          ? reason.slice(0, REASON_MAX_LENGTH).trim()
          : "",
    });

    if (recommendations.length === RECOMMENDATION_LIMIT) {
      break;
    }
  }

  return { recommendations, sentiments: parseSentiments(raw.comentarios) };
}

/** Score numérico 0-100 redondeado; lo demás cuenta como 0. */
function clampScore(score: unknown): number {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/** Bloque de comentarios tolerante: ausente o inválido → `null` (RF-9). */
function parseSentiments(raw: unknown): CommentSentiment[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const sentiments: CommentSentiment[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const { id, fuente, sentimiento } = entry as {
      id?: unknown;
      fuente?: unknown;
      sentimiento?: unknown;
    };

    if (
      typeof id === "number" &&
      (fuente === "titulo" || fuente === "actor") &&
      typeof sentimiento === "string" &&
      (SENTIMENTS as readonly string[]).includes(sentimiento)
    ) {
      sentiments.push({
        id,
        fuente,
        sentiment: sentimiento as Sentiment,
      });
    }
  }

  return sentiments.length > 0 ? sentiments : null;
}

/** Prompt en español: perfil + candidatos + reglas de salida estricta. */
export function buildPrompt(
  profile: UserProfile,
  candidates: Candidate[],
): string {
  return [
    "Eres el motor de recomendaciones de Nexus, una plataforma de películas y series.",
    "A partir del perfil del usuario y la lista de candidatos (los únicos títulos válidos para esta respuesta), devuelve dos bloques de JSON.",
    "",
    "Reglas:",
    `- Clasifica cada comentario del perfil como sentimiento "positivo", "negativo" o "neutro".`,
    `- Elige exactamente ${RECOMMENDATION_LIMIT} recomendaciones: SOLO con ids tomados de "candidatos", sin repetir ninguno y sin títulos que el usuario ya haya visto, marcado como favorito, descartado o puntuado como no me gusta.`,
    `- Ordénalas de mejor a peor con "score" de 100 a 0 y escribe cada "reason" en español, con máximo 120 caracteres, citando un gusto concreto del perfil (un género, director o un título parecido que haya visto o comentado).`,
    "- No inventes títulos ni ids: si un id no está en candidatos, no existe.",
    "",
    "Responde SOLO con JSON (sin texto adicional) con esta forma:",
    "{",
    '  "comentarios": [{ "id": 1, "fuente": "titulo", "sentimiento": "positivo" }],',
    '  "recomendaciones": [',
    '    { "id": "tt0133093", "score": 95, "reason": "Te gustó la ciencia ficción de The Matrix y este va en la misma línea" }',
    "  ]",
    "}",
    "",
    "Perfil del usuario:",
    JSON.stringify(
      {
        formato_preferido: profile.format,
        vistos: profile.watched,
        favoritos: profile.favorites,
        me_gusta: profile.likes,
        no_me_gusta: profile.dislikes,
        calificaciones: profile.ratings,
        comentarios: profile.comments,
      },
      null,
      1,
    ),
    "",
    "Candidatos:",
    JSON.stringify(candidates, null, 1),
  ].join("\n");
}

/**
 * Instrucción plana de la U3S5: la forma del JSON va entre llaves y el dato
 * del usuario en la última línea (así el simulador sabe qué responder).
 */
export function buildFichaPrompt(titulo: string): string {
  return [
    "Eres el asistente de fichas de Nexus, una plataforma de películas y series.",
    "Escribe la ficha del título que aparece en la última línea.",
    "Responde SOLO con un objeto JSON con esta forma exacta:",
    '{"genero": "drama", "sinopsis": "Una historia..."}',
    "- genero: el género principal en español, en una o dos palabras.",
    "- sinopsis: dos o tres frases en español, sin inventar datos sobre personas reales.",
    "",
    `Título: ${titulo}`,
  ].join("\n");
}

/**
 * Ficha de un título con IA (U3S5). Usa `EXTERNO_URL` si está configurada
 * (simulador de fallas) y `GEMINI_MODELO` si existe. Cualquier falla del
 * externo llega como `FallaExterna` con 502/503/504, nunca como 500.
 */
export async function preguntarFicha(titulo: string): Promise<Ficha> {
  const apiKey = env.GEMINI_API_KEY;

  // Con el simulador no hace falta clave; con Gemini real, sí.
  if (!apiKey && IA_URL.includes("googleapis.com")) {
    throw new FallaExterna(
      503,
      "Falta configurar la variable de entorno GEMINI_API_KEY",
    );
  }

  const respuesta = await llamarExterno(
    `${IA_URL}/v1beta/models/${encodeURIComponent(IA_MODELO)}:generateContent`,
    {
      metodo: "POST",
      encabezados: apiKey ? { "x-goog-api-key": apiKey } : {},
      cuerpo: {
        contents: [{ role: "user", parts: [{ text: buildFichaPrompt(titulo) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          // Sin «thinking»: una ficha corta no necesita razonar.
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
    },
  );

  return parseFichaResponse(respuesta);
}

/**
 * Valida la respuesta de Gemini en dos pasos (U3S5): primero el JSON exterior
 * (`candidates[0].content.parts[0].text`) y después el JSON interior. Si algo
 * no tiene la forma pedida, se responde 502 en vez de devolver basura.
 */
export function parseFichaResponse(payload: unknown): Ficha {
  const texto = (payload as GeminiApiResponse | null)?.candidates?.[0]?.content
    ?.parts?.[0]?.text;

  if (typeof texto !== "string" || !texto.trim()) {
    throw new FallaExterna(502, "La IA no devolvió la ficha esperada");
  }

  let datos: unknown;

  try {
    datos = JSON.parse(texto);
  } catch {
    throw new FallaExterna(502, "La IA respondió algo que no es JSON");
  }

  const { genero, sinopsis } = (datos ?? {}) as {
    genero?: unknown;
    sinopsis?: unknown;
  };

  if (
    typeof genero !== "string" ||
    !genero.trim() ||
    typeof sinopsis !== "string" ||
    !sinopsis.trim()
  ) {
    throw new FallaExterna(502, "La IA respondió en un formato inesperado");
  }

  return {
    genero: genero.trim().slice(0, FICHA_GENERO_MAX_LENGTH),
    sinopsis: sinopsis.trim().slice(0, FICHA_SINOPSIS_MAX_LENGTH),
  };
}
