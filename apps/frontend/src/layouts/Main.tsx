import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import Header from "../components/Header";
import Menu from "../components/Menu";
import MoviesSidebar from "../components/movies/MoviesSidebar";
import ScrollTopButton from "../components/ScrollTopButton";
import Loader from "./Loader";

interface MainProps {
  /**
   * Layout de la ficha (spec 002, D6): sin menú lateral y con la cabecera
   * en su variante «Volver» + logotipo.
   */
  detail?: boolean;
  /**
   * Layout de `/movies` (spec 003, D8): sin menú de destinos; la columna
   * izquierda es Ordenar + Filtros (`MoviesSidebar`). La cabecera es la de
   * Home, sin rediseño (RF-2).
   */
  browse?: boolean;
}

export default function Main({ detail = false, browse = false }: MainProps) {
  return (
    <div className="flex min-h-screen bg-slate-900 text-white">
      {browse ? <MoviesSidebar /> : !detail && <Menu />}

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
