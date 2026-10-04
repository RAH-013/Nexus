import { useRef } from "react";
import { Link, useMatches } from "react-router-dom";
import {
  BellIcon,
  SearchIcon,
  UserIcon,
  type SearchIconHandle,
} from "lucide-animated";
import { useUser } from "../hooks/useUser";
import UserMenu from "./UserMenu";

interface RouteHandle {
  title?: string;
}

function Header() {
  const { user } = useUser();
  const matches = useMatches();
  const searchRef = useRef<SearchIconHandle>(null);

  const currentTitle = [...matches]
    .reverse()
    .map((match) => (match.handle as RouteHandle | undefined)?.title)
    .find(Boolean);

  const handleSearchEnter = () => {
    searchRef.current?.startAnimation();
  };

  const handleSearchLeave = () => {
    searchRef.current?.stopAnimation();
  };

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 px-4 text-white sm:px-6">
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-xl">
        {currentTitle ??
          (user ? (
            <>
              ¡Bienvenido,{" "}
              <span className="text-teal-400">{user.name || user.email}!</span>
            </>
          ) : (
            "Explora. Descubre. Disfruta."
          ))}
      </h1>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <form
          role="search"
          className="group flex min-w-0 items-center rounded-lg bg-slate-700 px-2 text-slate-300 transition-colors hover:bg-slate-600 hover:text-white focus-within:bg-slate-600 focus-within:text-white sm:px-3"
          onMouseEnter={handleSearchEnter}
          onMouseLeave={handleSearchLeave}
        >
          <SearchIcon
            ref={searchRef}
            size={20}
            animateOnHover={false}
            aria-hidden="true"
          />
          <input
            type="search"
            name="search"
            placeholder="Busca una película, serie o actor"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Buscar películas, series o actores"
            className="w-24 min-w-0 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-400 sm:w-40 sm:px-3 md:w-64"
          />
        </form>
        {user ? (
          <>
            <button
              type="button"
              aria-label="Notificaciones"
              className="shrink-0 rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <BellIcon size={22} aria-hidden="true" />
            </button>
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
  );
}

export default Header;
