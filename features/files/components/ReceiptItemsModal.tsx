"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { Loader2, Receipt, Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api/apiFetch";
import {
  collectReceiptFilterOptions,
  filterReceiptLineItems,
  type ReceiptLineItemRecord,
} from "@/lib/files/receiptLineItems";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn } from "@/lib/utils";

interface ReceiptItemsModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  onOpenFile: (noteId: string) => void;
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

export function ReceiptItemsModal({
  open,
  onClose,
  workspaceId,
  onOpenFile,
}: ReceiptItemsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ReceiptLineItemRecord[]>([]);
  const [query, setQuery] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useScrollLock(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadItems = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/files/receipt-items?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      const data = (await res.json()) as { items?: ReceiptLineItemRecord[] };
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [open, loadItems]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const filterOptions = useMemo(() => collectReceiptFilterOptions(items), [items]);

  const filteredItems = useMemo(
    () =>
      filterReceiptLineItems(items, {
        query,
        vendor: vendor || undefined,
        category: category || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [items, query, vendor, category, dateFrom, dateTo],
  );

  const handleRowClick = (noteId: string) => {
    onOpenFile(noteId);
    onClose();
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="receipt-ledger-modal fixed inset-0 z-[860] flex items-center justify-center p-4 md:p-6">
      <div
        className="absolute inset-0 overlay-scrim backdrop-blur-[4px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-ledger-title"
        className="receipt-ledger-modal__panel relative flex w-full max-w-[min(72rem,96vw)] max-h-[min(92vh,56rem)] flex-col overflow-hidden rounded-2xl border border-border-glass bg-bg-panel shadow-2xl modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="receipt-ledger-modal__header flex shrink-0 items-start justify-between gap-4 border-b border-border-glass px-5 py-4 md:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-neon-purple">
              <Receipt className="h-5 w-5 shrink-0" aria-hidden />
              <h2 id="receipt-ledger-title" className="text-lg font-semibold text-text-primary">
                Receipt items
              </h2>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Line items detected from receipt analysis. Click a row to open the source file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="receipt-ledger-modal__close rounded-xl border border-border-glass p-2 text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
            aria-label="Close receipt items"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="receipt-ledger-modal__filters shrink-0 border-b border-border-glass px-5 py-3 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items, vendors, warranty…"
                className="w-full rounded-xl border border-border-glass bg-bg-secondary py-2.5 pl-9 pr-3 text-sm focus:border-neon-purple/40 focus:outline-none"
                aria-label="Search receipt items"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center">
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="receipt-ledger-filter rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5 text-sm focus:border-neon-purple/40 focus:outline-none"
                aria-label="Filter by vendor"
              >
                <option value="">All vendors</option>
                {filterOptions.vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="receipt-ledger-filter rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5 text-sm focus:border-neon-purple/40 focus:outline-none"
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {filterOptions.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="receipt-ledger-filter rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5 text-sm focus:border-neon-purple/40 focus:outline-none"
                aria-label="From date"
              />

              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="receipt-ledger-filter rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5 text-sm focus:border-neon-purple/40 focus:outline-none"
                aria-label="To date"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <span>
              {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
              {items.length !== filteredItems.length ? ` of ${items.length}` : ""}
            </span>
            {(query || vendor || category || dateFrom || dateTo) && (
              <button
                type="button"
                className="font-semibold text-neon-purple hover:underline"
                onClick={() => {
                  setQuery("");
                  setVendor("");
                  setCategory("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="receipt-ledger-modal__body min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-text-muted">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-neon-purple" />
              Loading receipt items…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center px-6 text-center">
              <Receipt className="mb-3 h-8 w-8 text-text-faint" aria-hidden />
              <p className="text-sm font-medium text-text-primary">No receipt items yet</p>
              <p className="mt-1 max-w-sm text-sm text-text-muted">
                Run AI name on a receipt in Review — detected line items will appear here
                automatically.
              </p>
            </div>
          ) : (
            <table className="receipt-ledger-table w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-bg-secondary/95 backdrop-blur-sm">
                <tr>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Warranty</th>
                  <th>Return policy</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="receipt-ledger-table__row cursor-pointer transition hover:bg-surface-hover"
                    onClick={() => handleRowClick(item.noteId)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(item.noteId);
                      }
                    }}
                  >
                    <td className="whitespace-nowrap">{formatDate(item.transactionDate)}</td>
                    <td>{item.vendor || "—"}</td>
                    <td className="font-medium text-text-primary">{item.itemName}</td>
                    <td>{item.itemCategory || "—"}</td>
                    <td className="whitespace-nowrap tabular-nums">{formatMoney(item.pricePaid)}</td>
                    <td className="max-w-[12rem] text-text-secondary">{item.warranty || "—"}</td>
                    <td className="max-w-[12rem] text-text-secondary">{item.returnPolicy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}