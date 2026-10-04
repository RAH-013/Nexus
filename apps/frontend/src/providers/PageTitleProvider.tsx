import { useState, type ReactNode } from "react";
import { PageTitleContext } from "../context/PageTitleContext";

interface PageTitleProviderProps {
  children: ReactNode;
}

function PageTitleProvider({ children }: PageTitleProviderProps) {
  const [title, setTitle] = useState<string | null>(null);

  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export default PageTitleProvider;
