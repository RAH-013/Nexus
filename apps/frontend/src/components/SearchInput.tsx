import { useRef, useState } from "react";
import { SearchIcon, type SearchIconHandle } from "lucide-animated";
import { useLocation, useNavigate } from "react-router-dom";
import ContextMenu from "./ContextMenu";
import SearchPanel from "./SearchPanel";

function SearchInput() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<SearchIconHandle>(null);
  const [query, setQuery] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const panelOpen = query.trim().length >= 3 && !dismissed;

  const closePanel = () => {
    setDismissed(true);
  };

  const handleSearchEnter = () => {
    searchRef.current?.startAnimation();
  };

  const handleSearchLeave = () => {
    searchRef.current?.stopAnimation();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = query.trim();

    if (trimmed.length < 3) return;

    setDismissed(true);

    const alreadyThere =
      location.pathname === "/search" &&
      new URLSearchParams(location.search).get("q") === trimmed;

    if (!alreadyThere) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <div className="relative min-w-0">
      <form
        role="search"
        className="group flex min-w-0 items-center rounded-lg bg-slate-700 px-2 text-slate-300 transition-colors hover:bg-slate-600 hover:text-white focus-within:bg-slate-600 focus-within:text-white sm:px-3"
        onSubmit={handleSubmit}
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
          maxLength={80}
          aria-label="Buscar películas, series o actores"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setDismissed(false);
          }}
          onBlur={(event) => {
            const container = event.currentTarget.parentElement;

            if (
              event.relatedTarget instanceof Node &&
              container?.contains(event.relatedTarget)
            ) {
              return;
            }

            setDismissed(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDismissed(true);
            }
          }}
          className="w-24 min-w-0 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-400 sm:w-40 sm:px-3 md:w-64"
        />
      </form>

      {panelOpen && (
        <ContextMenu className="left-0 right-auto w-[min(92vw,26rem)]">
          <SearchPanel
            query={query}
            onClose={closePanel}
            onNavigate={closePanel}
          />
        </ContextMenu>
      )}
    </div>
  );
}

export default SearchInput;
