import { useEffect, useRef, useState } from "react";
import { BellIcon } from "lucide-animated";
import ContextMenu from "./ContextMenu";

function NotificationsMenu() {
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

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Notificaciones"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
      >
        <BellIcon size={21} aria-hidden="true" />
      </button>
      {open && (
        <ContextMenu className="w-80">
          <div className="px-3 py-2.5">
            <p className="text-sm font-medium text-white">Notificaciones</p>
            <p className="mt-1 text-xs text-slate-400">
              No tienes notificaciones nuevas.
            </p>
          </div>
        </ContextMenu>
      )}
    </div>
  );
}

export default NotificationsMenu;
