"use client";

import React, { useEffect, useState } from "react";
import { DollarSign, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import type { CompetitorNameSuggestion } from "@/lib/notebooks/competitorAggregates";
import { CompetitorNamePicker } from "./CompetitorNamePicker";

const dollarAmountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function parseDollarInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatDollarInput(value: number): string {
  if (!value) return "";
  return dollarAmountFormatter.format(value);
}

function formatDollarInputFromString(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return dollarAmountFormatter.format(Number(digits));
}

interface AddCompetitorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: CompetitorNameSuggestion[];
  onAdd: (name: string, salesPotential: number) => void | Promise<unknown>;
}

export function AddCompetitorModal({
  open,
  onOpenChange,
  suggestions,
  onAdd,
}: AddCompetitorModalProps) {
  const [name, setName] = useState("");
  const [sales, setSales] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSales("");
    setIsAdding(false);
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Competitor name is required");
      return;
    }
    setIsAdding(true);
    try {
      await onAdd(trimmed, parseDollarInput(sales));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add competitor");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => !isAdding && onOpenChange(false)}
      title="Add competitor"
      mobileHeight="90"
      enableDragDismiss={!isAdding}
      zIndex={1000}
      desktopMaxWidth="max-w-md"
      panelClassName="add-competitor-modal"
      ariaLabel="Add competitor"
    >
      <p className="px-5 text-sm text-text-muted -mt-1 mb-3">
        Pick an existing name from other notebooks or enter a new one.
      </p>

      <div className="px-5 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Competitor
          </span>
          <CompetitorNamePicker
            value={name}
            onChange={setName}
            suggestions={suggestions}
            disabled={isAdding}
            placeholder="Select or add competitor"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Sales potential
          </span>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
            <input
              value={sales}
              onChange={(e) => setSales(formatDollarInputFromString(e.target.value))}
              onBlur={() => setSales(formatDollarInput(parseDollarInput(sales)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit();
              }}
              placeholder="0"
              inputMode="numeric"
              disabled={isAdding}
              className="w-full min-h-[44px] bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2.5 text-sm text-right focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint tabular-nums disabled:opacity-50"
            />
          </div>
        </label>
      </div>

      <div className="keyboard-stable-sheet__footer flex items-center justify-end gap-2 px-5 pt-4 mt-4 border-t border-border-glass bg-bg-secondary/40">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={isAdding}
          className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isAdding || !name.trim()}
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-4 py-2 text-sm font-medium text-neon-purple-tint disabled:opacity-40"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add competitor
        </button>
      </div>
    </BottomSheet>
  );
}