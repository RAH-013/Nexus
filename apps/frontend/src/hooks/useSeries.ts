import { useContext } from "react";
import { SeriesContext } from "../context/SeriesContext";

export const useSeries = () => {
  const ctx = useContext(SeriesContext);
  if (!ctx) throw new Error("useSeries debe usarse dentro de SeriesProvider");
  return ctx;
};