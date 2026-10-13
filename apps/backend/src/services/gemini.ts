import { env } from "../config/env";

/** Límite de la ficha «Para ti» (spec 004, RF-12). */
export const RECOMMENDATION_LIMIT = 10;

/** Motivo de cada recomendación: tope del RF-8 (razón ≤140 caracteres). */
const REASON_MAX_LENGTH = 140;

/** Un solo intento por modelo; el timeout es el criterio del resto del backend. */
const REQUEST_TIMEOUT_MS = 10_000;

const MAX_OUTPUT_TOKENS = 2048;

const TEMPERATURE = 0.3;

export type Sentiment = "positivo" | "negativo" | "neutro";

const SENTIMENTS: readonly Sentiment[] = ["positivo", "negativo", "neutro"];

/** Título del perfil tal como viaja al prompt (nombre si se pudo enriquecer). */
export interface PromptTitle {
  id: string;
  type: "movie" | "series";
  name?: string;
  year?: string;
  genres?: string[];
}

/** Comentario propio del usuario que el modelo debe clasificar (RF-9). */
export interface PromptComment {
  id: number;
  fuente: "titulo" | "actor";
  text: string;
  actorName?: string;
}

export interface UserProfile {
  format: "series" | "peliculas" | "mixto";
  watched: PromptTitle[];
  favorites: PromptTitle[];
  likes: PromptTitle[];
  dislikes: PromptTitle[];
  comments: PromptComment[];
}

export interface Candidate {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  year?: string;
  genres?: string[];
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
  const url = `${env.GEMINI_BASE_URL}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
    `- Elige exactamente ${RECOMMENDATION_LIMIT} recomendaciones: SOLO con ids tomados de "candidatos", sin repetir ninguno y sin títulos que el usuario ya haya visto, marcado como favorito o puntuado como no me gusta.`,
    `- Ordénalas de mejor a peor con "score" de 100 a 0 y escribe cada "reason" en español, con máximo 120 caracteres, citando un gusto concreto del perfil (un género o un título parecido que haya visto o comentado).`,
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
