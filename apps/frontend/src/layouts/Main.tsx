import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import Header from "../components/Header";
import Menu from "../components/Menu";
import ScrollTopButton from "../components/ScrollTopButton";
import Loader from "./Loader";

export default function Main() {
  return (
    <div className="flex min-h-screen bg-slate-900 text-white">
      <Menu />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

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
