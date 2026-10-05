import { useContext } from "react";
import { MoviesContext } from "../context/MoviesContext";

export const useMovies = () => {
  const ctx = useContext(MoviesContext);
  if (!ctx) throw new Error("useMovies debe usarse dentro de MoviesProvider");
  return ctx;
};