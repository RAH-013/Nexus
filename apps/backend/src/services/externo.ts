/**
 * Llamadas a servicios externos (guía U3S5): tiempo máximo por intento,
 * reintentos solo para fallas pasajeras y validación del JSON.
 *
 * Copia en TypeScript del `externo.js` del kit: timeout por intento,
 * 3 intentos (1 + 2 reintentos), backoff exponencial con jitter y `Retry-After`
 * cuando el externo responde 429. Un 400/401/404 no se reintenta: no se
 * arregla solo.
 */

/**
 * Tiempo máximo esperando al externo, por intento. El kit usa 2 s; aquí se
 * deja en 4 s porque el arranque en frío de Gemini (DNS + TLS + respuesta)
 * tarda ~3.2 s y con 2 s los tres intentos abortaban. El presupuesto total
 * (9 s) mantiene la respuesta por debajo de los 10 s que exige probar_ia.py.
 */
const TIMEOUT_MS = 4_000;

/** 1 intento + 2 reintentos. */
const INTENTOS = 3;

/** Fallas pasajeras: solo estas vale la pena reintentarlas. */
const TRANSITORIOS = new Set([429, 500, 502, 503, 504]);

/**
 * Tope de la llamada completa. Un `Retry-After` grande (429) no debe dejar
 * al usuario esperando: si la espera se pasa del presupuesto, se corta y se
 * responde el error que corresponda.
 */
const PRESUPUESTO_MS = 9_000;

export type FallaExternaCodigo = 502 | 503 | 504;

/** Falla del externo ya traducida al código HTTP que debe ver el usuario. */
export class FallaExterna extends Error {
  constructor(
    readonly codigo: FallaExternaCodigo,
    message: string,
    readonly estado?: number,
  ) {
    super(message);
    this.name = "FallaExterna";
  }
}

export interface OpcionesExterno {
  metodo?: "GET" | "POST";
  cuerpo?: unknown;
  encabezados?: Record<string, string>;
  /** Misma llave en todos los intentos (operaciones con efectos). */
  llave?: string;
}

const dormir = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Llama a un servicio externo y devuelve su JSON ya parseado. Si tarda, se
 * cae o responde algo que no es JSON, lanza `FallaExterna` con 502/504.
 */
export async function llamarExterno(
  url: string,
  opciones: OpcionesExterno = {},
): Promise<unknown> {
  const metodo = opciones.metodo ?? "GET";
  const inicio = Date.now();
  let estado: number | null = null;
  let texto = "";

  for (let intento = 1; intento <= INTENTOS; intento += 1) {
    let esperaMinima = 0;

    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          "content-type": "application/json",
          ...opciones.encabezados,
          ...(opciones.llave ? { "Idempotency-Key": opciones.llave } : {}),
        },
        body:
          opciones.cuerpo === undefined
            ? undefined
            : JSON.stringify(opciones.cuerpo),
        // <- el tiempo máximo de espera de la llamada al externo.
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      estado = respuesta.status;
      texto = await respuesta.text();

      if (estado === 429) {
        const retryAfter = Number(respuesta.headers.get("retry-after") ?? 0);
        esperaMinima = Number.isFinite(retryAfter) ? retryAfter * 1_000 : 0;
      }
    } catch {
      // No respondió a tiempo (timeout) o no hubo conexión.
      estado = null;
    }

    // Éxito o error que no se arregla reintentando (400, 401, 404...).
    if (estado !== null && !TRANSITORIOS.has(estado)) {
      break;
    }

    if (intento < INTENTOS) {
      const espera =
        Math.max(esperaMinima, 500 * 2 ** (intento - 1)) +
        Math.random() * 200; // backoff + jitter
      const restante = PRESUPUESTO_MS - (Date.now() - inicio);

      if (espera >= restante) {
        break;
      }

      console.warn(
        `[externo] intento ${intento}: ${estado ?? "sin respuesta a tiempo"} -> reintento en ${(espera / 1000).toFixed(1)} s`,
      );
      await dormir(espera);
    }
  }

  if (estado === null) {
    throw new FallaExterna(
      504,
      `El servicio externo no respondió a tiempo (${INTENTOS} intentos)`,
    );
  }

  if (TRANSITORIOS.has(estado)) {
    throw new FallaExterna(
      502,
      `El servicio externo sigue fallando (${estado}) después de ${INTENTOS} intentos`,
      estado,
    );
  }

  if (estado >= 400) {
    throw new FallaExterna(
      502,
      `El servicio externo rechazó la petición (${estado}); no se reintenta`,
      estado,
    );
  }

  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new FallaExterna(
      502,
      "El servicio externo respondió algo que no es JSON",
      estado,
    );
  }
}
