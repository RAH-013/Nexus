import { createContext } from "react";

export interface PageTitleContextType {
  title: string | null;
  setTitle: (title: string | null) => void;
}

export const PageTitleContext = createContext<PageTitleContextType | null>(
  null,
);
