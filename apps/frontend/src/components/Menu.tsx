import { useRef, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  ClapIcon,
  HeartIcon,
  HistoryIcon,
  PlayIcon,
  PartyPopperIcon,
  UsersIcon,
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
}

function MenuItem({ icon: Icon, label, to }: MenuItemProps) {
  const iconRef = useRef<AnimatedIconHandle>(null);

  return (
    <Link
      to={to}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-slate-300 transition hover:bg-slate-700 hover:text-white"
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
    >
      <Icon ref={iconRef} size={22} animateOnHover={false} />
      <span>{label}</span>
    </Link>
  );
}

function Menu() {
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
    <aside className="m-3 flex h-[calc(100vh-1.5rem)] w-64 shrink-0 flex-col rounded-2xl bg-slate-800 p-4 text-white shadow-lg">
      <Link to="/" className="mb-8 px-3">
        <img src="logo.png" alt="Logotipo" />
      </Link>

      <nav className="flex flex-col gap-2">
        {mainItems.map((item) => (
          <MenuItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            to={item.to}
          />
        ))}
      </nav>
    </aside>
  );
}

export default Menu;
