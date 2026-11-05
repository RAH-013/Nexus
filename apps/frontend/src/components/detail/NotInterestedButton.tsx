import type { MediaType } from "../../api/cinemeta";
import { useInteractions } from "../../hooks/useInteractions";

interface NotInterestedButtonProps {
  id: string;
  type?: MediaType;
}

export default function NotInterestedButton({
  id,
  type = "movie",
}: NotInterestedButtonProps) {
  const { isNotInterested, toggleNotInterested, isPending, enabled } =
    useInteractions();

  if (!enabled) {
    return null;
  }

  const dismissed = isNotInterested(id);
  const pending = isPending(id);

  return (
    <button
      type="button"
      aria-pressed={dismissed}
      disabled={pending}
      onClick={() => void toggleNotInterested(type, id)}
      className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 ${
        dismissed
          ? "bg-slate-700 text-amber-300 hover:bg-slate-600 focus-visible:outline-amber-400"
          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 focus-visible:outline-indigo-400"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
      {dismissed ? "Descartado (No te interesa)" : "No me interesa"}
    </button>
  );
}
