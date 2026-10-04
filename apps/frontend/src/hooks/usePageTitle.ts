import { useContext } from "react";
import { PageTitleContext } from "../context/PageTitleContext";

export function usePageTitle() {
  const context = useContext(PageTitleContext);

  if (!context) {
    throw new Error("usePageTitle debe usarse dentro de PageTitleProvider");
  }

  return context;
}
