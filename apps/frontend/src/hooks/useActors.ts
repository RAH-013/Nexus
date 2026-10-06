import { useContext } from "react";
import { ActorsContext, type ActorsContextType } from "../context/ActorsContext";

export const useActors = (): ActorsContextType => {
  const ctx = useContext(ActorsContext);
  if (!ctx) throw new Error("useActors debe usarse dentro de ActorsProvider");
  return ctx;
};
