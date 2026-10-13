import { useContext } from "react";
import {
  ReactionsContext,
  type ReactionsContextType,
} from "../context/ReactionsContext";

export const useReactions = (): ReactionsContextType => {
  const ctx = useContext(ReactionsContext);
  if (!ctx) throw new Error("useReactions debe usarse dentro de ReactionsProvider");
  return ctx;
};
