import { useContext } from "react";
import { ViewsContext, type ViewsContextType } from "../context/ViewsContext";

export const useViews = (): ViewsContextType => {
  const ctx = useContext(ViewsContext);
  if (!ctx) throw new Error("useViews debe usarse dentro de ViewsProvider");
  return ctx;
};