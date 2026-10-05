import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import Header from "../components/Header";
import Menu from "../components/Menu";
import ScrollTopButton from "../components/ScrollTopButton";
import Loader from "./Loader";

interface MainProps {
  /**
   * Layout de la ficha (spec 002, D6): sin menú lateral y con la cabecera
   * en su variante «Volver» + logotipo.
   */
  detail?: boolean;
}

export default function Main({ detail = false }: MainProps) {
  return (
    <div className="flex min-h-screen bg-slate-900 text-white">
      {!detail && <Menu />}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header detail={detail} />

        <main className="flex-1 p-6">
          <Suspense fallback={<Loader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <ScrollTopButton />
    </div>
  );
}
