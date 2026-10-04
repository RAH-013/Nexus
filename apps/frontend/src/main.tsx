import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./main.css";

import AppRouter from "./routes/AppRoutes";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
