"use client";

import { useMemo, useState } from "react";
import { Search, MapPin, Hexagon, X } from "lucide-react";
import type { MapStore, MapTerritory } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  stores: MapStore[];
  territories: MapTerritory[];
  onSelectStore: (id: string) => void;
  onSelectTerritory: (id: string) => void;
  className?: string;
}

export function SearchBar({
  stores,
  territories,
  onSelectStore,
  onSelectTerritory,
  className,
}: SearchBarProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 1) return { stores: [] as MapStore[], territories: [] as MapTerritory[] };

    const matchedStores = stores
      .filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.store_number ?? "").toLowerCase().includes(query) ||
          s.address.toLowerCase().includes(query) ||
          (s.city ?? "").toLowerCase().includes(query),
      )
      .slice(0, 8);

    const matchedTerritories = territories
      .filter((t) => t.name.toLowerCase().includes(query))
      .slice(0, 8);

    return { stores: matchedStores, territories: matchedTerritories };
  }, [q, stores, territories]);

  const hasResults = results.stores.length > 0 || results.territories.length > 0;

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search stores & territories…"
        className="h-10 w-full rounded-xl border border-border-glass bg-bg-secondary/95 pl-9 pr-9 text-sm text-text-primary shadow-md backdrop-blur outline-none focus:border-neon-purple/50"
      />
      {q && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:bg-surface-hover"
          onClick={() => {
            setQ("");
            setOpen(false);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-xl border border-border-glass bg-bg-secondary shadow-xl">
          {!hasResults && <p className="p-3 text-sm text-text-muted">No matches</p>}
          {results.stores.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Stores
              </p>
              {results.stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
                  onClick={() => {
                    onSelectStore(s.id);
                    setOpen(false);
                    setQ(s.name);
                  }}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-purple" />
                  <span>
                    <span className="font-medium text-text-primary">{s.name}</span>
                    {s.store_number && (
                      <span className="text-text-muted"> · #{s.store_number}</span>
                    )}
                    <span className="block text-xs text-text-muted">{s.address}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {results.territories.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Territories
              </p>
              {results.territories.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
                  onClick={() => {
                    onSelectTerritory(t.id);
                    setOpen(false);
                    setQ(t.name);
                  }}
                >
                  <Hexagon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-purple" />
                  <span>
                    <span className="font-medium text-text-primary">{t.name}</span>
                    <span className="block text-xs text-text-muted">
                      {t.territory_type} · {t.status}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
