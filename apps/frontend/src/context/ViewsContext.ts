import { createContext } from "react";
import type { MediaType } from "../api/cinemeta";

/**
 * Películas marcadas como vistas por el usuario en sesión (spec 003, RF-8…RF-10):
 * la fuente de verdad es PostgreSQL vía `/api/views`, nunca `localStorage`
 * (RNF-8). Sin sesión el set está vacío y `enabled` oculta los controles.
 */
export interface ViewsContextType {
  /** `externalId` de las películas con `UserAction` VIEW del usuario. */
  viewedIds: ReadonlySet<string>;
  /** «He visto» = existe al menos un VIEW (caso 10). */
  isViewed: (id: string) => boolean;
  /** true mientras esa película tiene una petición en vuelo (caso 9). */
  isPending: (id: string) => boolean;
  /** Conmuta en servidor recibiendo opcionalmente el tipo ('movie' | 'series'). */
  toggle: (id: string, type?: MediaType) => Promise<void>;
  /** Solo con sesión existen el botón y el bloque Mostrar (RF-8, RF-9). */
  enabled: boolean;
}

export const ViewsContext = createContext<ViewsContextType | null>(null);