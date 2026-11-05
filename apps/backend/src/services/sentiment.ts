export type Sentiment = "positivo" | "negativo" | "neutro";

/**
 * Vocabulario léxico especializado en crítica y opinión cinematográfica (español e inglés).
 * No requiere llamadas externas ni dependencias pesadas.
 */
const POSITIVE_TERMS = new Set([
  "excelente",
  "obra maestra",
  "maravilla",
  "maravillosa",
  "maravilloso",
  "increible",
  "increíble",
  "buena",
  "bueno",
  "buenisima",
  "buenísima",
  "buenisimo",
  "buenísimo",
  "genial",
  "espectacular",
  "fantastica",
  "fantástica",
  "fantastico",
  "fantástico",
  "recomendada",
  "recomendable",
  "recomendadisima",
  "recomendadísima",
  "me encanto",
  "me encantó",
  "me gusto",
  "me gustó",
  "fascinante",
  "brillante",
  "divertida",
  "divertido",
  "emocionante",
  "joya",
  "perfecta",
  "perfecto",
  "top",
  "sublime",
  "interesante",
  "impresionante",
  "great",
  "amazing",
  "masterpiece",
  "awesome",
  "good",
  "love",
  "loved",
  "excellent",
  "enjoyable",
]);

const NEGATIVE_TERMS = new Set([
  "mala",
  "malo",
  "malisima",
  "malísima",
  "malisimo",
  "malísimo",
  "horrible",
  "pesima",
  "pésima",
  "pesimo",
  "pésimo",
  "aburrida",
  "aburrido",
  "decepcion",
  "decepción",
  "decepcionante",
  "desastre",
  "basura",
  "infumable",
  "pesadez",
  "no me gusto",
  "no me gustó",
  "no la recomiendo",
  "no lo recomiendo",
  "perdida de tiempo",
  "pérdida de tiempo",
  "lenta",
  "floja",
  "sin sentido",
  "mediocre",
  "peor",
  "terrible",
  "bad",
  "awful",
  "boring",
  "waste",
  "disaster",
  "hate",
  "hated",
  "worst",
  "poor",
]);

const NEGATION_WORDS = new Set(["no", "nunca", "jamas", "tampoco", "nada", "ni"]);

/**
 * Normaliza texto eliminando signos de puntuación y convirtiendo a minúsculas.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve diacríticos para robustez
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Analiza el sentimiento de una opinión o comentario.
 * Retorna: "positivo", "negativo" o "neutro".
 */
export function analyzeSentiment(rawText: string): Sentiment {
  if (!rawText || typeof rawText !== "string") {
    return "neutro";
  }

  const clean = normalizeText(rawText);

  if (clean.length === 0) {
    return "neutro";
  }

  let positiveScore = 0;
  let negativeScore = 0;

  // 1. Detección de frases multipalabra
  for (const term of POSITIVE_TERMS) {
    const normTerm = normalizeText(term);
    if (normTerm.includes(" ") && clean.includes(normTerm)) {
      positiveScore += 2;
    }
  }

  for (const term of NEGATIVE_TERMS) {
    const normTerm = normalizeText(term);
    if (normTerm.includes(" ") && clean.includes(normTerm)) {
      negativeScore += 2;
    }
  }

  // 2. Tokenización y análisis con prefijos de negación (ventana de hasta 3 palabras hacia atrás)
  const words = clean.split(" ");
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Ver si en las 3 palabras anteriores hay un negador (e.g. "no es buena", "tampoco fue tan buena")
    const prevWords = words.slice(Math.max(0, i - 3), i);
    const isNegated = prevWords.some((w) => NEGATION_WORDS.has(w));

    if (POSITIVE_TERMS.has(word)) {
      if (isNegated) {
        negativeScore += 2; // "no es buena" -> negativo
      } else {
        positiveScore += 1;
      }
    } else if (NEGATIVE_TERMS.has(word)) {
      if (isNegated) {
        positiveScore += 1; // "no es mala" -> moderadamente positivo
      } else {
        negativeScore += 1;
      }
    }
  }

  const delta = positiveScore - negativeScore;

  if (delta >= 1) {
    return "positivo";
  }

  if (delta <= -1) {
    return "negativo";
  }

  return "neutro";
}
