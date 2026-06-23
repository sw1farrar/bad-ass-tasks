"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { ArrowDown, ArrowUp, Eye, Loader2, Pencil, Receipt, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { buildReceiptPreviewCatalog } from "@/lib/files/receiptPreview";
import { ReceiptSourcePreviewModal } from "./ReceiptSourcePreviewModal";
import { apiFetch } from "@/lib/api/apiFetch";
import {
  defaultReceiptLedgerSortDirection,
  RECEIPT_LEDGER_DEFAULT_SORT_COLUMN,
  RECEIPT_LEDGER_DEFAULT_SORT_DIRECTION,
  RECEIPT_LEDGER_PAGE_SIZE,
  type ReceiptLedgerSortColumn,
  type ReceiptLedgerSortDirection,
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

type EditDraft = {
  itemName: string;
  vendor: string;
  itemCategory: string;
  pricePaid: string;
  transactionDate: string;
  warranty: string;
  returnPolicy: string;
};

type LedgerFilters = {
  query: string;
  vendor: string;
  category: string;
  dateFrom: string;
  dateTo: string;
};

type LedgerSort = {
  column: ReceiptLedgerSortColumn;
  direction: ReceiptLedgerSortDirection;
};

const RECEIPT_LEDGER_TRANSITION_MS = 320;

const LEDGER_SORTABLE_COLUMNS: { column: ReceiptLedgerSortColumn; label: string }[] = [
  { column: "transactionDate", label: "Date" },
  { column: "vendor", label: "Vendor" },
  { column: "itemName", label: "Item" },
  { column: "itemCategory", label: "Category" },
  { column: "pricePaid", label: "Price" },
  { column: "warranty", label: "Warranty" },
  { column: "returnPolicy", label: "Return policy" },
];

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

function toEditDraft(item: ReceiptLineItemRecord): EditDraft {
  return {
    itemName: item.itemName,
    vendor: item.vendor ?? "",
    itemCategory: item.itemCategory ?? "",
    pricePaid: item.pricePaid != null ? String(item.pricePaid) : "",
    transactionDate: item.transactionDate ?? "",
    warranty: item.warranty ?? "",
    returnPolicy: item.returnPolicy ?? "",
  };
}

function buildLedgerQuery(
  workspaceId: string,
  filters: LedgerFilters,
  sort: LedgerSort,
  offset: number,
  includeFilters: boolean,
): string {
  const params = new URLSearchParams({
    workspaceId,
    limit: String(RECEIPT_LEDGER_PAGE_SIZE),
    offset: String(offset),
    sortBy: sort.column,
    sortDir: sort.direction,
  });
  if (includeFilters) params.set("includeFilters", "1");
  if (filters.query.trim()) params.set("query", filters.query.trim());
  if (filters.vendor) params.set("vendor", filters.vendor);
  if (filters.category) params.set("category", filters.category);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return `/api/files/receipt-items?${params.toString()}`;
}

function ReceiptLedgerSortHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
}: {
  label: string;
  column: ReceiptLedgerSortColumn;
  activeColumn: ReceiptLedgerSortColumn;
  direction: ReceiptLedgerSortDirection;
  onSort: (column: ReceiptLedgerSortColumn) => void;
}) {
  const isActive = activeColumn === column;
  return (
    <th scope="col" aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={cn("receipt-ledger-table__sort", isActive && "receipt-ledger-table__sort--active")}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        <span className="receipt-ledger-table__sort-icons" aria-hidden>
          <ArrowUp
            className={cn(
              "receipt-ledger-table__sort-icon",
              isActive && direction === "asc" && "receipt-ledger-table__sort-icon--active",
            )}
          />
          <ArrowDown
            className={cn(
              "receipt-ledger-table__sort-icon",
              isActive && direction === "desc" && "receipt-ledger-table__sort-icon--active",
            )}
          />
        </span>
      </button>
    </th>
  );
}

type ReceiptLedgerPolicyTooltipState = {
  text: string;
  top: number;
  left: number;
  placement: "above" | "below";
};

function ReceiptLedgerPolicyCell({ value }: { value: string | null | undefined }) {
  const text = value?.trim() ?? "";
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [tooltip, setTooltip] = useState<ReceiptLedgerPolicyTooltipState | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element || !text || expanded) {
      setOverflows(false);
      return;
    }

    const measure = () => {
      setOverflows(element.scrollWidth > element.clientWidth + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);

  const showTooltipOnHover = Boolean(text) && !expanded;

  const updateTooltipPosition = useCallback(() => {
    const element = cellRef.current;
    if (!element || !showTooltipOnHover) return;

    const rect = element.getBoundingClientRect();
    const placement = rect.top > 120 ? "above" : "below";
    setTooltip({
      text,
      top: placement === "above" ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
      placement,
    });
  }, [showTooltipOnHover, text]);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  useEffect(() => {
    if (expanded) setTooltip(null);
  }, [expanded]);

  useEffect(() => {
    if (!tooltip) return;
    const handleReposition = () => updateTooltipPosition();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [tooltip, updateTooltipPosition]);

  if (!text) {
    return <span className="text-text-muted">—</span>;
  }

  const showToggle = expanded || overflows;

  return (
    <>
      <div
        ref={cellRef}
        className="receipt-ledger-policy-cell"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onMouseEnter={showTooltipOnHover ? updateTooltipPosition : undefined}
        onMouseLeave={showTooltipOnHover ? hideTooltip : undefined}
        onFocus={showTooltipOnHover ? updateTooltipPosition : undefined}
        onBlur={showTooltipOnHover ? hideTooltip : undefined}
      >
        <div
          ref={contentRef}
          className={cn(
            "receipt-ledger-policy-cell__text",
            !expanded && "receipt-ledger-policy-cell__text--clamped",
          )}
        >
          {text}
        </div>
        {showToggle ? (
          <button
            type="button"
            className="receipt-ledger-policy-cell__toggle"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>

      {tooltip
        ? createPortal(
            <div
              role="tooltip"
              className={cn(
                "receipt-ledger-policy-tooltip",
                tooltip.placement === "above"
                  ? "receipt-ledger-policy-tooltip--above"
                  : "receipt-ledger-policy-tooltip--below",
              )}
              style={{ top: tooltip.top, left: tooltip.left }}
            >
              {tooltip.text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ReceiptLedgerEditForm({
  editDraft,
  setEditDraft,
  onSave,
  onCancel,
  saving,
}: {
  editDraft: EditDraft;
  setEditDraft: React.Dispatch<React.SetStateAction<EditDraft | null>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="receipt-ledger-edit grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="receipt-ledger-edit__field sm:col-span-2">
        <span>Item</span>
        <input
          value={editDraft.itemName}
          onChange={(e) => setEditDraft((d) => (d ? { ...d, itemName: e.target.value } : d))}
          className="input w-full rounded-lg px-2.5 py-2 text-sm"
        />
      </label>
      <label className="receipt-ledger-edit__field">
        <span>Vendor</span>
        <input
          value={editDraft.vendor}
          onChange={(e) => setEditDraft((d) => (d ? { ...d, vendor: e.target.value } : d))}
          className="input w-full rounded-lg px-2.5 py-2 text-sm"
        />
      </label>
      <label className="receipt-ledger-edit__field">
        <span>Category</span>
        <input
          value={editDraft.itemCategory}
          onChange={(e) => setEditDraft((d) => (d ? { ...d, itemCategory: e.target.value } : d))}
          className="input w-full rounded-lg px-2.5 py-2 text-sm"
        />
      </label>
      <label className="receipt-ledger-edit__field">
        <span>Price</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={editDraft.pricePaid}
          onChange={(e) => setEditDraft((d) => (d ? { ...d, pricePaid: e.target.value } : d))}
          className="input w-full rounded-lg px-2.5 py-2 text-sm"
        />
      </label>
      <label className="receipt-ledger-edit__field">
        <span>Date</span>
        <input
          type="date"
          value={editDraft.transactionDate}
          onChange={(e) =>
            setEditDraft((d) => (d ? { ...d, transactionDate: e.target.value } : d))
          }
          className="input w-full rounded-lg px-2.5 py-2 text-sm"
        />
      </label>
      <label className="receipt-ledger-edit__field sm:col-span-2">
        <span>Warranty</span>
        <input
          value={editDraft.warranty}
          onChange={(e) => setEditDraft((d) => (d ? { ...d, warranty: e.target.value } : d))}
          className="input w-full rounded-lg px-2.5 py-2 text-sm"
        />
      </label>
      <label className="receipt-ledger-edit__field sm:col-span-2">
        <span>Return policy</span>
        <input
          value={editDraft.returnPolicy}
          onChange={(e) => setEditDraft((d) => (d ? { ...d, returnPolicy: e.target.value } : d))}
          className="input w-full rounded-lg px-2.5 py-2 text-sm"
        />
      </label>
      <div className="receipt-ledger-edit__actions flex items-center gap-2 sm:col-span-2 lg:col-span-4">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="btn btn-primary px-3 py-1.5 text-xs font-semibold"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="btn btn-ghost px-3 py-1.5 text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ReceiptItemsModal({
  open,
  onClose,
  workspaceId,
  onOpenFile,
}: ReceiptItemsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(open);
  const [entered, setEntered] = useState(false);
  const [items, setItems] = useState<ReceiptLineItemRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [vendors, setVendors] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [filters, setFilters] = useState<LedgerFilters>({
    query: "",
    vendor: "",
    category: "",
    dateFrom: "",
    dateTo: "",
  });
  const [sort, setSort] = useState<LedgerSort>({
    column: RECEIPT_LEDGER_DEFAULT_SORT_COLUMN,
    direction: RECEIPT_LEDGER_DEFAULT_SORT_DIRECTION,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReceiptLineItemRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewStartNoteId, setPreviewStartNoteId] = useState<string | null>(null);
  const [previewCatalog, setPreviewCatalog] = useState<
    ReturnType<typeof buildReceiptPreviewCatalog>
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fetchGenerationRef = useRef(0);

  useScrollLock(present);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setPresent(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setEntered(false);
    const timer = window.setTimeout(() => setPresent(false), RECEIPT_LEDGER_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, query: queryInput }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!workspaceId) return;
      const generation = ++fetchGenerationRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const res = await apiFetch(
          buildLedgerQuery(workspaceId, filters, sort, offset, !append && offset === 0),
        );
        const data = (await res.json()) as {
          items?: ReceiptLineItemRecord[];
          total?: number;
          hasMore?: boolean;
          vendors?: string[];
          categories?: string[];
        };
        if (generation !== fetchGenerationRef.current) return;

        const pageItems = data.items ?? [];
        setItems((current) => (append ? [...current, ...pageItems] : pageItems));
        setTotal(data.total ?? pageItems.length);
        setHasMore(!!data.hasMore);
        if (!append && offset === 0) {
          setVendors(data.vendors ?? []);
          setCategories(data.categories ?? []);
        }
      } catch {
        if (generation !== fetchGenerationRef.current) return;
        if (!append) {
          setItems([]);
          setTotal(0);
          setHasMore(false);
        }
      } finally {
        if (generation === fetchGenerationRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [workspaceId, filters, sort],
  );

  useEffect(() => {
    if (!open) return;
    setEditingId(null);
    setEditDraft(null);
    setDeleteTarget(null);
    void fetchPage(0, false);
  }, [open, fetchPage]);

  useEffect(() => {
    if (!open || !hasMore || loading || loadingMore) return;
    const root = scrollRef.current;
    const target = loadMoreRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchPage(items.length, true);
        }
      },
      { root, rootMargin: "120px", threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [open, hasMore, loading, loadingMore, items.length, fetchPage]);

  useEffect(() => {
    if (!present) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && entered && !editingId && !deleteTarget && !previewStartNoteId) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [present, entered, onClose, editingId, deleteTarget, previewStartNoteId]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.query ||
          filters.vendor ||
          filters.category ||
          filters.dateFrom ||
          filters.dateTo,
      ),
    [filters],
  );

  const startEdit = (item: ReceiptLineItemRecord) => {
    setEditingId(item.id);
    setEditDraft(toEditDraft(item));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = async (itemId: string) => {
    if (!editDraft || savingId) return;
    const itemName = editDraft.itemName.trim();
    if (!itemName) {
      toast.error("Item name is required");
      return;
    }

    setSavingId(itemId);
    try {
      const pricePaid =
        editDraft.pricePaid.trim() === "" ? null : Number(editDraft.pricePaid);
      const res = await apiFetch(`/api/files/receipt-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName,
          vendor: editDraft.vendor.trim() || null,
          itemCategory: editDraft.itemCategory.trim() || null,
          pricePaid: pricePaid != null && Number.isFinite(pricePaid) ? pricePaid : null,
          transactionDate: editDraft.transactionDate.trim() || null,
          warranty: editDraft.warranty.trim() || null,
          returnPolicy: editDraft.returnPolicy.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        item?: ReceiptLineItemRecord;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.item) {
        throw new Error(data.message ?? data.error ?? "update_failed");
      }
      setItems((current) =>
        current.map((item) => (item.id === itemId ? data.item! : item)),
      );
      cancelEdit();
      toast.success("Receipt item updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "update_failed";
      toast.error("Could not update item", {
        description:
          message === "duplicate_item"
            ? "Another item with the same name, price, and date already exists."
            : "Try again.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/files/receipt-items/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean };
      if (!res.ok || !data.ok) {
        throw new Error("delete_failed");
      }
      setItems((current) => current.filter((row) => row.id !== deleteTarget.id));
      setTotal((current) => Math.max(0, current - 1));
      if (editingId === deleteTarget.id) cancelEdit();
      toast.success("Receipt item deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete item");
    } finally {
      setDeleting(false);
    }
  };

  const handleRowOpen = (noteId: string) => {
    if (editingId || deleteTarget || previewStartNoteId) return;
    onOpenFile(noteId);
    onClose();
  };

  const handlePreviewReceipt = (noteId: string) => {
    if (editingId || deleteTarget || previewStartNoteId) return;
    setPreviewCatalog(buildReceiptPreviewCatalog(items));
    setPreviewStartNoteId(noteId);
  };

  const clearFilters = () => {
    setQueryInput("");
    setFilters({
      query: "",
      vendor: "",
      category: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const handleSort = (column: ReceiptLedgerSortColumn) => {
    setSort((current) => {
      if (current.column === column) {
        return {
          column,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        column,
        direction: defaultReceiptLedgerSortDirection(column),
      };
    });
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderRowActions = (item: ReceiptLineItemRecord, isDeletingRow: boolean) => (
    <div className="receipt-ledger-row-actions flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handlePreviewReceipt(item.noteId);
        }}
        disabled={!!editingId || isDeletingRow || !!deleteTarget || !!previewStartNoteId}
        className="receipt-ledger-row-action receipt-ledger-row-action--preview"
        aria-label={`Preview receipt for ${item.itemName}`}
        title="Preview receipt"
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => startEdit(item)}
        disabled={!!editingId || isDeletingRow || !!deleteTarget}
        className="receipt-ledger-row-action"
        aria-label={`Edit ${item.itemName}`}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setDeleteTarget(item)}
        disabled={!!editingId || isDeletingRow || !!deleteTarget}
        className="receipt-ledger-row-action receipt-ledger-row-action--danger"
        aria-label={`Delete ${item.itemName}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );

  const renderItemCard = (item: ReceiptLineItemRecord) => {
    const isEditing = editingId === item.id;
    const isSaving = savingId === item.id;

    if (isEditing && editDraft) {
      return (
        <article
          key={item.id}
          className="receipt-ledger-card receipt-ledger-card--editing"
        >
          <ReceiptLedgerEditForm
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            onSave={() => void saveEdit(item.id)}
            onCancel={cancelEdit}
            saving={isSaving}
          />
        </article>
      );
    }

    return (
      <article
        key={item.id}
        className={cn(
          "receipt-ledger-card",
          (isSaving || deleteTarget?.id === item.id) && "opacity-60",
        )}
      >
        <button
          type="button"
          className="receipt-ledger-card__main text-left"
          onClick={() => handleRowOpen(item.noteId)}
        >
          <div className="receipt-ledger-card__title-row">
            <h3 className="receipt-ledger-card__title">{item.itemName}</h3>
            <span className="receipt-ledger-card__price tabular-nums">
              {formatMoney(item.pricePaid)}
            </span>
          </div>
          <div className="receipt-ledger-card__meta">
            {item.vendor ? <span>{item.vendor}</span> : null}
            {item.transactionDate ? (
              <span className="tabular-nums">{formatDate(item.transactionDate)}</span>
            ) : null}
            {item.itemCategory ? <span>{item.itemCategory}</span> : null}
          </div>
          {(item.warranty || item.returnPolicy) && (
            <p className="receipt-ledger-card__policy">
              {[item.warranty, item.returnPolicy].filter(Boolean).join(" · ")}
            </p>
          )}
        </button>
        <div className="receipt-ledger-card__actions">
          {renderRowActions(item, deleteTarget?.id === item.id && deleting)}
        </div>
      </article>
    );
  };

  const renderTableRow = (item: ReceiptLineItemRecord) => {
    const isEditing = editingId === item.id;
    const isSaving = savingId === item.id;

    if (isEditing && editDraft) {
      return (
        <tr key={item.id} className="receipt-ledger-table__row receipt-ledger-table__row--editing">
          <td colSpan={8}>
            <ReceiptLedgerEditForm
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              onSave={() => void saveEdit(item.id)}
              onCancel={cancelEdit}
              saving={isSaving}
            />
          </td>
        </tr>
      );
    }

    return (
      <tr
        key={item.id}
        className={cn(
          "receipt-ledger-table__row transition hover:bg-surface-hover",
          (isSaving || deleteTarget?.id === item.id) && "opacity-60",
        )}
      >
        <td
          className="receipt-ledger-table__open-cell whitespace-nowrap cursor-pointer"
          onClick={() => handleRowOpen(item.noteId)}
        >
          {formatDate(item.transactionDate)}
        </td>
        <td
          className="receipt-ledger-table__open-cell cursor-pointer"
          onClick={() => handleRowOpen(item.noteId)}
        >
          {item.vendor || "—"}
        </td>
        <td
          className="receipt-ledger-table__open-cell font-medium text-text-primary cursor-pointer"
          onClick={() => handleRowOpen(item.noteId)}
        >
          {item.itemName}
        </td>
        <td
          className="receipt-ledger-table__open-cell cursor-pointer"
          onClick={() => handleRowOpen(item.noteId)}
        >
          {item.itemCategory || "—"}
        </td>
        <td
          className="receipt-ledger-table__open-cell whitespace-nowrap tabular-nums cursor-pointer"
          onClick={() => handleRowOpen(item.noteId)}
        >
          {formatMoney(item.pricePaid)}
        </td>
        <td className="receipt-ledger-table__policy-cell text-text-secondary">
          <ReceiptLedgerPolicyCell value={item.warranty} />
        </td>
        <td className="receipt-ledger-table__policy-cell text-text-secondary">
          <ReceiptLedgerPolicyCell value={item.returnPolicy} />
        </td>
        <td className="receipt-ledger-table__actions-col">
          {renderRowActions(item, deleteTarget?.id === item.id && deleting)}
        </td>
      </tr>
    );
  };

  if (!mounted || !present) return null;

  return createPortal(
    <>
      <div
        className={cn("receipt-ledger-drawer", entered && "receipt-ledger-drawer--open")}
        data-receipt-ledger-portal
        role="presentation"
      >
        <button
          type="button"
          className="receipt-ledger-drawer__scrim"
          onClick={onClose}
          aria-label="Close receipt ledger"
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-ledger-title"
          className="receipt-ledger-drawer__panel"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="receipt-ledger-drawer__header">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-neon-purple">
                <Receipt className="h-5 w-5 shrink-0" aria-hidden />
                <h2 id="receipt-ledger-title" className="text-lg font-semibold text-text-primary">
                  Receipt ledger
                </h2>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                Search, edit, or remove line items. Preview the receipt or open a row to view the
                source file.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="receipt-ledger-drawer__close"
            >
              Close
            </button>
          </header>

          <div className="receipt-ledger-drawer__filters">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                <input
                  type="search"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Search items, vendors, warranty…"
                  className="w-full rounded-xl border border-border-glass bg-bg-secondary py-2.5 pl-9 pr-3 text-sm focus:border-neon-purple/40 focus:outline-none"
                  aria-label="Search receipt items"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-wrap xl:items-center">
                <select
                  value={filters.vendor}
                  onChange={(e) =>
                    setFilters((current) => ({ ...current, vendor: e.target.value }))
                  }
                  className="receipt-ledger-filter rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5 text-sm focus:border-neon-purple/40 focus:outline-none"
                  aria-label="Filter by vendor"
                >
                  <option value="">All vendors</option>
                  {vendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.category}
                  onChange={(e) =>
                    setFilters((current) => ({ ...current, category: e.target.value }))
                  }
                  className="receipt-ledger-filter rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5 text-sm focus:border-neon-purple/40 focus:outline-none"
                  aria-label="Filter by category"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters((current) => ({ ...current, dateFrom: e.target.value }))
                  }
                  className="receipt-ledger-filter rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5 text-sm focus:border-neon-purple/40 focus:outline-none"
                  aria-label="From date"
                />

                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters((current) => ({ ...current, dateTo: e.target.value }))
                  }
                  className="receipt-ledger-filter rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5 text-sm focus:border-neon-purple/40 focus:outline-none"
                  aria-label="To date"
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
              <span>
                {loading && items.length === 0
                  ? "Searching…"
                  : `${total.toLocaleString()} item${total === 1 ? "" : "s"}${
                      items.length < total
                        ? ` · showing ${items.length.toLocaleString()}`
                        : ""
                    }`}
              </span>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="font-semibold text-neon-purple hover:underline"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>

          <div ref={scrollRef} className="receipt-ledger-drawer__body">
            {loading && items.length === 0 ? (
              <div className="receipt-ledger-drawer__empty">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-neon-purple" />
                Loading receipt items…
              </div>
            ) : items.length === 0 ? (
              <div className="receipt-ledger-drawer__empty receipt-ledger-drawer__empty--message">
                <Receipt className="mb-3 h-8 w-8 text-text-faint" aria-hidden />
                <p className="text-sm font-medium text-text-primary">No receipt items found</p>
                <p className="mt-1 max-w-sm text-sm text-text-muted">
                  {hasActiveFilters
                    ? "Try different filters or clear your search."
                    : "Run AI name on a receipt in Review, then add detected items to the ledger."}
                </p>
              </div>
            ) : (
              <>
                <div className="receipt-ledger-cards">{items.map(renderItemCard)}</div>

                <div className="receipt-ledger-table-wrap">
                  <table className="receipt-ledger-table w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-[1] bg-bg-secondary/95 backdrop-blur-sm">
                      <tr>
                        {LEDGER_SORTABLE_COLUMNS.map(({ column, label }) => (
                          <ReceiptLedgerSortHeader
                            key={column}
                            label={label}
                            column={column}
                            activeColumn={sort.column}
                            direction={sort.direction}
                            onSort={handleSort}
                          />
                        ))}
                        <th scope="col" className="receipt-ledger-table__actions-col">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>{items.map(renderTableRow)}</tbody>
                  </table>
                </div>

                <div ref={loadMoreRef} className="receipt-ledger-drawer__sentinel" aria-hidden>
                  {loadingMore ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-xs text-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-neon-purple" />
                      Loading more…
                    </div>
                  ) : hasMore ? (
                    <div className="py-4 text-center text-[11px] text-text-faint">
                      Scroll for more
                    </div>
                  ) : items.length > RECEIPT_LEDGER_PAGE_SIZE ? (
                    <div className="py-4 text-center text-[11px] text-text-faint">
                      End of ledger
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      <ReceiptSourcePreviewModal
        catalog={previewCatalog}
        startNoteId={previewStartNoteId}
        onClose={() => {
          setPreviewStartNoteId(null);
          setPreviewCatalog([]);
        }}
      />

      <ConfirmationModal
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null);
        }}
        title="Delete receipt item?"
        highlight={deleteTarget?.itemName}
        description="This removes the line item from your receipt ledger. The source file will not be deleted."
        confirmText="Delete item"
        cancelText="Keep item"
        variant="destructive"
        isLoading={deleting}
        onConfirm={confirmDelete}
      />
    </>,
    document.body,
  );
}