import { useEffect, useState } from "react";
import { ArrowUpIcon } from "lucide-animated";

function ScrollTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Volver arriba"
      onClick={scrollToTop}
      className="fixed right-6 bottom-6 z-50 rounded-full bg-slate-700 p-3 text-white shadow-lg transition hover:bg-slate-600"
    >
      <ArrowUpIcon size={22} />
    </button>
  );
}

export default ScrollTopButton;
