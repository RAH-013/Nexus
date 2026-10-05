import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./main.css";

import AppRouter from "./routes/AppRoutes";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("No se encontró el elemento #root");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
