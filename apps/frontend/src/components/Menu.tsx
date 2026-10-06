import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Link } from "react-router-dom";
import {
  ClapIcon,
  HeartIcon,
  HistoryIcon,
  MenuIcon,
  PlayIcon,
  PartyPopperIcon,
  UsersIcon,
  XIcon,
} from "lucide-animated";

type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type AnimatedIconProps = {
  size?: number;
  animateOnHover?: boolean;
};

type AnimatedIcon = ComponentType<
  AnimatedIconProps & {
    ref?: React.Ref<AnimatedIconHandle>;
  }
>;

interface MenuItemProps {
  icon: AnimatedIcon;
  label: string;
  to: string;
  /** Cierra el menú en pantalla estrecha al navegar. */
  onSelect?: () => void;
}

function MenuItem({ icon: Icon, label, to, onSelect }: MenuItemProps) {
  const iconRef = useRef<AnimatedIconHandle>(null);

  return (
    <Link
      to={to}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-slate-300 transition hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
      onClick={onSelect}
    >
      <Icon ref={iconRef} size={22} animateOnHover={false} />
      <span>{label}</span>
    </Link>
  );
}

/**
 * Menú lateral: en escritorio es el mismo de siempre (RNF-4); en ventana
 * estrecha se oculta y aparece un botón que lo abre como panel superpuesto
 * (RF-14).
 */
function Menu() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeMenu]);

  const mainItems = [
    {
      icon: ClapIcon,
      label: "Películas",
      to: "/movies",
    },
    {
      icon: PlayIcon,
      label: "Series",
      to: "/series",
    },
    {
      icon: UsersIcon,
      label: "Actores",
      to: "/actors",
    },
    {
      icon: PartyPopperIcon,
      label: "Premios",
      to: "/awards",
    },
    {
      icon: HeartIcon,
      label: "Favoritos",
      to: "/favorites",
    },
    {
      icon: HistoryIcon,
      label: "Recientes",
      to: "/recent",
    },
  ];

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        aria-label="Abrir menú"
        aria-expanded={open}
        aria-controls="side-menu"
        onClick={() => setOpen(true)}
        className="ml-1 mt-3 self-start rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 lg:hidden"
      >
        <MenuIcon size={24} aria-hidden="true" />
      </button>

      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          tabIndex={-1}
          onClick={closeMenu}
          className="fixed inset-0 z-40 cursor-default bg-black/60 lg:hidden"
        />
      )}

      <aside
        id="side-menu"
        className={`fixed left-3 top-3 z-50 flex h-full w-64 shrink-0 flex-col bg-slate-800 p-4 text-white shadow-lg transition-transform lg:static  lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Cerrar menú"
          onClick={closeMenu}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 lg:hidden"
        >
          <XIcon size={20} aria-hidden="true" />
        </button>

        <Link to="/" className="mb-8 px-3" onClick={() => setOpen(false)}>
          <img src="logo.png" alt="Logotipo" />
        </Link>

        <nav className="flex flex-col gap-2">
          {mainItems.map((item) => (
            <MenuItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              to={item.to}
              onSelect={() => setOpen(false)}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}

export default Menu;
