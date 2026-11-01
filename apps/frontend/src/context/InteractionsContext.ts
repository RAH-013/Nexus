import { createContext } from "react";
import type { MediaType } from "../api/cinemeta";
import type { ImpressionItem } from "../api/interactions";

export interface InteractionsContextType {
  getRating: (id: string) => number | null;
  setRating: (type: MediaType, id: string, rating: number) => Promise<boolean>;
  isNotInterested: (id: string) => boolean;
  toggleNotInterested: (type: MediaType, id: string) => Promise<boolean>;
  recordDetail: (type: MediaType, id: string) => void;
  recordImpressions: (items: ImpressionItem[]) => void;
  isPending: (id: string) => boolean;
  enabled: boolean;
}

export const InteractionsContext = createContext<InteractionsContextType>({
  getRating: () => null,
  setRating: async () => false,
  isNotInterested: () => false,
  toggleNotInterested: async () => false,
  recordDetail: () => {},
  recordImpressions: () => {},
  isPending: () => false,
  enabled: false,
});
