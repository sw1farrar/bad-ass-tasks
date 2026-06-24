"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DollarSign, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { NotebookCompetitor } from "@/types";

interface NotebookCompetitorsPanelProps {
  competitors: NotebookCompetitor[];
  ourSales: number;
  onOurSalesChange: (value: number) => void | Promise<unknown>;
  onAdd: (name: string, salesPotential: number) => void | Promise<unknown>;
  onUpdate: (id: string, updates: { name?: string; salesPotential?: number }) => void | Promise<unknown>;
  onRequestDelete: (id: string) => void;
}

function parseDollarInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function NotebookCompetitorsPanel({
  competitors,
  ourSales,
  onOurSalesChange,
  onAdd,
  onUpdate,
  onRequestDelete,
}: NotebookCompetitorsPanelProps) {
  const [newName, setNewName] = useState("");
  const [newSales, setNewSales] = useState("");
  const [ourSalesInput, setOurSalesInput] = useState(String(ourSales || ""));

  useEffect(() => {
    setOurSalesInput(String(ourSales || ""));
  }, [ourSales]);

  const totalCompetitorSales = useMemo(
    () => competitors.reduce((sum, c) => sum + (c.salesPotential || 0), 0),
    [competitors],
  );

  const totalMarket = ourSales + totalCompetitorSales;
  const marketShare = totalMarket > 0 ? (ourSales / totalMarket) * 100 : 0;

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Competitor name is required");
      return;
    }
    try {
      await onAdd(name, parseDollarInput(newSales));
      setNewName("");
      setNewSales("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add competitor");
    }
  };

  const commitOurSales = () => {
    const value = parseDollarInput(ourSalesInput);
    setOurSalesInput(String(value));
    if (value !== ourSales) void onOurSalesChange(value);
  };

  return (
    <div className="notebooks-section-panel flex flex-1 flex-col min-h-0 min-w-0 overflow-y-auto">
      <div className="shrink-0 p-4 border-b border-border-glass">
        <div className="max-w-2xl grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Our sales
            </span>
            <div className="relative mt-1.5">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
              <input
                value={ourSalesInput}
                onChange={(e) => setOurSalesInput(e.target.value)}
                onBlur={commitOurSales}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitOurSales();
                }}
                inputMode="decimal"
                placeholder="0"
                className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40"
              />
            </div>
          </label>
          <div className="rounded-xl border border-border-glass bg-bg-secondary px-4 py-3">
            <div className="text-xs text-text-muted">Market share</div>
            <div className="text-2xl font-bold text-neon-purple-tint mt-0.5">
              {marketShare.toFixed(1)}%
            </div>
            <div className="text-xs text-text-faint mt-1">
              {formatCurrency(ourSales)} of {formatCurrency(totalMarket)} total
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 p-4 border-b border-border-glass">
        <div className="flex flex-wrap gap-2 max-w-2xl">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Competitor name"
            className="flex-1 min-w-[10rem] bg-bg-secondary border border-border-glass rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
          />
          <div className="relative w-36">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
            <input
              value={newSales}
              onChange={(e) => setNewSales(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd();
              }}
              placeholder="Sales potential"
              inputMode="decimal"
              className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!newName.trim()}
            className="flex items-center gap-1.5 rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-3 py-2 text-sm font-medium text-neon-purple-tint disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      <div className="flex-1 p-4">
        {competitors.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">No competitors listed yet.</p>
        ) : (
          <ul className="max-w-2xl space-y-2">
            {competitors.map((competitor) => (
              <li
                key={competitor.id}
                className="flex items-center gap-2 rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5"
              >
                <input
                  defaultValue={competitor.name}
                  key={`name-${competitor.id}-${competitor.updatedAt}`}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) {
                      e.target.value = competitor.name;
                      return;
                    }
                    if (raw !== competitor.name) void onUpdate(competitor.id, { name: raw });
                  }}
                  className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none text-text-primary"
                  aria-label="Competitor name"
                />
                <div className="relative w-32 shrink-0">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-faint" />
                  <input
                    defaultValue={String(competitor.salesPotential || "")}
                    key={`sales-${competitor.id}-${competitor.updatedAt}`}
                    onBlur={(e) => {
                      const next = parseDollarInput(e.target.value);
                      if (next !== competitor.salesPotential) {
                        void onUpdate(competitor.id, { salesPotential: next });
                      }
                    }}
                    inputMode="decimal"
                    className="w-full bg-bg border border-border-glass rounded-lg pl-7 pr-2 py-1.5 text-sm text-right focus:outline-none focus:border-neon-purple/40"
                    aria-label="Sales potential"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRequestDelete(competitor.id)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
                  aria-label="Delete competitor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {competitors.length > 0 && (
          <div className="max-w-2xl mt-6 pt-4 border-t border-border-glass flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-text-muted">Total competitor sales</span>
              <div className="font-semibold text-text-primary">
                {formatCurrency(totalCompetitorSales)}
              </div>
            </div>
            <div>
              <span className="text-text-muted">Our sales</span>
              <div className="font-semibold text-text-primary">{formatCurrency(ourSales)}</div>
            </div>
            <div>
              <span className="text-text-muted">Combined market</span>
              <div className="font-semibold text-text-primary">{formatCurrency(totalMarket)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}