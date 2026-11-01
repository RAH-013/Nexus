import { useContext } from "react";
import {
  InteractionsContext,
  type InteractionsContextType,
} from "../context/InteractionsContext";

export function useInteractions(): InteractionsContextType {
  return useContext(InteractionsContext);
}
