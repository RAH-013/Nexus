import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LogoutIcon, UserIcon } from "lucide-animated";
import { useUser } from "../hooks/useUser";
import { swal } from "../utils/swal";

function UserMenu() {
  const { user, logout } = useUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    const result = await swal.fire({
      icon: "warning",
      title: "¿Cerrar sesión?",
      text: "Tendrás que iniciar sesión nuevamente para acceder a tu cuenta.",
      showCancelButton: true,
      confirmButtonText: "Cerrar sesión",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    await logout();
    setOpen(false);

    await swal.fire({
      icon: "success",
      title: "Sesión cerrada",
      timer: 1500,
      timerProgressBar: true,
      showConfirmButton: false,
    });
  };

  const avatarUrl = user?.image || "/api/auth/get-avatar";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Menú de usuario"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 text-slate-300 transition-colors hover:ring-2 hover:ring-teal-400/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
      >
        {user ? (
          <img
            src={avatarUrl}
            alt={`Foto de perfil de ${user.name || user.email}`}
            className="h-full w-full object-cover"
            onError={(event) => {
              if (!event.currentTarget.src.endsWith("/api/auth/get-avatar")) {
                event.currentTarget.src = "/api/auth/get-avatar";
              }
            }}
          />
        ) : (
          <UserIcon size={21} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 p-1 shadow-xl">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <UserIcon size={18} aria-hidden="true" />
            Perfil
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogoutIcon size={18} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
