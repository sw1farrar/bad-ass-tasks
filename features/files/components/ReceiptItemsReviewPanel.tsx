"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Receipt } from "lucide-react";
import type { EnrichedReceiptLineItem } from "@/lib/files/enrichReceiptItemPolicies";
import { buildReceiptDedupeKey } from "@/lib/files/receiptLineItems";
import { cn } from "@/lib/utils";

export type ReceiptItemDraft = EnrichedReceiptLineItem & {
  key: string;
  selected: boolean;
};

export function buildReceiptItemDrafts(
  noteId: string,
  items: EnrichedReceiptLineItem[],
): ReceiptItemDraft[] {
  return items.map((item) => ({
    ...item,
    key: buildReceiptDedupeKey({
      noteId,
      itemName: item.itemName,
      pricePaid: item.pricePaid,
      transactionDate: item.transactionDate,
    }),
    selected: true,
  }));
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

interface ReceiptItemsReviewPanelProps {
  items: ReceiptItemDraft[];
  onChange: (items: ReceiptItemDraft[]) => void;
  onAddToLedger: () => void;
  adding?: boolean;
  disabled?: boolean;
}

export function ReceiptItemsReviewPanel({
  items,
  onChange,
  onAddToLedger,
  adding = false,
  disabled = false,
}: ReceiptItemsReviewPanelProps) {
  if (!items.length) return null;

  const selectedCount = items.filter((item) => item.selected).length;
  const allSelected = selectedCount === items.length;

  const toggleItem = (key: string) => {
    onChange(
      items.map((item) =>
        item.key === key ? { ...item, selected: !item.selected } : item,
      ),
    );
  };

  const toggleAll = () => {
    const next = !allSelected;
    onChange(items.map((item) => ({ ...item, selected: next })));
  };

  return (
    <section
      className="receipt-items-review rounded-xl border border-neon-purple/25 bg-neon-purple/5 overflow-hidden"
      aria-labelledby="receipt-items-review-title"
    >
      <header className="receipt-items-review__header flex flex-wrap items-center justify-between gap-3 border-b border-neon-purple/15 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-neon-purple">
            <Receipt className="h-4 w-4 shrink-0" aria-hidden />
            <h3
              id="receipt-items-review-title"
              className="text-sm font-semibold text-text-primary"
            >
              Receipt items found
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
            Uncheck anything you do not want in your receipt ledger.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleAll}
          disabled={disabled || adding}
          className="text-[11px] font-semibold text-neon-purple hover:underline disabled:opacity-50"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </header>

      <div className="receipt-items-review__list max-h-[min(18rem,40vh)] overflow-auto">
        <ul className="divide-y divide-border-glass/60">
          {items.map((item) => (
            <li key={item.key}>
              <label
                className={cn(
                  "receipt-items-review__row flex cursor-pointer items-start gap-3 px-3 py-2.5 transition sm:px-4",
                  item.selected ? "bg-bg/40" : "bg-transparent opacity-70",
                  disabled && "pointer-events-none opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleItem(item.key)}
                  disabled={disabled || adding}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-border-glass text-neon-purple focus:ring-neon-purple/40"
                  aria-label={`Include ${item.itemName}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary">
                    {item.itemName}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-muted">
                    {item.vendor ? <span>{item.vendor}</span> : null}
                    {item.transactionDate ? (
                      <span className="tabular-nums">{formatDate(item.transactionDate)}</span>
                    ) : null}
                    {item.itemCategory ? <span>{item.itemCategory}</span> : null}
                    <span className="tabular-nums font-medium text-text-secondary">
                      {formatMoney(item.pricePaid)}
                    </span>
                  </span>
                  {(item.warranty || item.returnPolicy) && (
                    <span className="mt-1 block text-[10px] leading-snug text-text-faint">
                      {[item.warranty, item.returnPolicy].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <footer className="receipt-items-review__footer flex items-center justify-between gap-3 border-t border-neon-purple/15 px-3 py-2.5 sm:px-4">
        <span className="text-[11px] text-text-muted">
          {selectedCount} of {items.length} selected
        </span>
        <button
          type="button"
          onClick={onAddToLedger}
          disabled={disabled || adding || selectedCount === 0}
          className={cn(
            "btn btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold",
            (disabled || adding || selectedCount === 0) && "opacity-50 pointer-events-none",
          )}
        >
          {adding ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Adding…
            </>
          ) : (
            <>Add {selectedCount} to ledger</>
          )}
        </button>
      </footer>
    </section>
  );
}