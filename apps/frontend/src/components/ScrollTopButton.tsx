import { ArrowUpIcon } from "lucide-animated";

interface ScrollTopButtonProps {
  visible: boolean;
  onClick: () => void;
}

function ScrollTopButton({ visible, onClick }: ScrollTopButtonProps) {
  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Volver arriba"
      onClick={onClick}
      className="fixed right-6 bottom-6 z-50 rounded-full bg-slate-700 p-3 text-white shadow-lg transition hover:bg-slate-600"
    >
      <ArrowUpIcon size={22} />
    </button>
  );
}

export default ScrollTopButton;
