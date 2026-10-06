import { Suspense, useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import Header from "../components/Header";
import Loader from "../layouts/Loader";
import Menu from "../components/Menu";
import MoviesSidebar from "../components/movies/MoviesSidebar";
import ScrollTopButton from "../components/ScrollTopButton";

interface MainProps {
  detail?: boolean;
  browse?: boolean;
  sidebar?: React.ReactNode;
}

export default function Main({
  detail = false,
  browse = false,
  sidebar,
}: MainProps) {
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const handleMainScroll = (event: React.UIEvent<HTMLElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    setScrolled(scrollTop > 0);
    setShowScrollTop(scrollTop > 300);
  };

  const scrollToTop = () => {
    mainRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-white">
      {browse ? (sidebar ?? <MoviesSidebar />) : !detail && <Menu />}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header detail={detail} scrolled={scrolled} />

        <main
          ref={mainRef}
          className="min-h-0 flex-1 overflow-y-auto p-6"
          onScroll={handleMainScroll}
        >
          <Suspense fallback={<Loader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <ScrollTopButton visible={showScrollTop} onClick={scrollToTop} />
    </div>
  );
}
