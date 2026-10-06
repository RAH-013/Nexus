import { useRef } from "react";
import { Link, useLocation, useMatches, useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  UserIcon,
  type ArrowLeftIconHandle,
} from "lucide-animated";
import { useUser } from "../hooks/useUser";

import NotificationsMenu from "./NotificationsMenu";
import SearchInput from "./SearchInput";
import UserMenu from "./UserMenu";

interface RouteHandle {
  title?: string;
}

interface HeaderProps {
  detail?: boolean;
  scrolled?: boolean;
}

function Header({ detail = false, scrolled = false }: HeaderProps) {
  const { user } = useUser();
  const matches = useMatches();
  const navigate = useNavigate();
  const location = useLocation();
  const arrowRef = useRef<ArrowLeftIconHandle>(null);

  const currentTitle = [...matches]
    .reverse()
    .map((match) => (match.handle as RouteHandle | undefined)?.title)
    .find(Boolean);

  const goBack = () => {
    if (location.key === "default") {
      navigate("/");
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="z-200 min-h-16">
      <header
        className={`flex min-h-16 items-center justify-between gap-4 px-4 text-white transition-all duration-300 sm:px-6 ${
          scrolled
            ? "border-b border-slate-700/50 bg-linear-to-b from-slate-950 via-slate-950/95 to-slate-950/80 shadow-lg shadow-slate-950/20 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        {detail ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              aria-label="Volver"
              onClick={goBack}
              onMouseEnter={() => arrowRef.current?.startAnimation()}
              onMouseLeave={() => arrowRef.current?.stopAnimation()}
              className="shrink-0 rounded-full p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <ArrowLeftIcon
                ref={arrowRef}
                size={20}
                animateOnHover={false}
                aria-hidden="true"
              />
            </button>

            <Link
              to="/"
              className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <img src="/logo.png" alt="Logotipo" className="h-8 w-auto" />
            </Link>
          </div>
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-xl">
            {currentTitle ??
              (user ? (
                <>
                  ¡Bienvenido,{" "}
                  <span className="text-teal-400">
                    {user.name || user.email}!
                  </span>
                </>
              ) : (
                "Explora. Descubre. Disfruta."
              ))}
          </h1>
        )}

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <SearchInput />

          {user ? (
            <>
              <NotificationsMenu />
              <UserMenu />
            </>
          ) : (
            <Link
              to="/auth"
              aria-label="Iniciar sesión"
              className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 sm:px-4"
            >
              <UserIcon size={20} aria-hidden="true" />
              <span className="hidden sm:inline">Iniciar sesión</span>
              <span className="sm:hidden">Entrar</span>
            </Link>
          )}
        </div>
      </header>
    </div>
  );
}

export default Header;
