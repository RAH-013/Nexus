import type { MouseEventHandler, ReactNode } from "react";

interface ContextMenuProps {
  children: ReactNode;
  className?: string;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
}

function ContextMenu({
  children,
  className = "",
  onMouseDown,
}: ContextMenuProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute right-0 top-full z-100 mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl backdrop-blur-none ${className}`}
    >
      {children}
    </div>
  );
}

export default ContextMenu;
