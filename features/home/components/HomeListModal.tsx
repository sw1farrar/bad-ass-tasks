"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ListChecks, X } from "lucide-react";
import { WorkspaceItemDeepLink } from "@/components/WorkspaceItemDeepLink";
import { cn, triggerHaptic } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";
import { getListColorStyle } from "@/store/listSlice";
import "@/features/lists/lists-workspace.css";

export interface HomeListModalTarget {
  listId: string;
  workspaceId: string;
  workspaceName: string;
  title: string;
  color: string;
}

interface HomeListModalProps {
  target: HomeListModalTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onItemsChanged?: () => void;
  onOpenInWorkspace?: () => void;
}

export function HomeListModal({
  target,
  isOpen,
  onClose,
  onItemsChanged,
  onOpenInWorkspace,
}: HomeListModalProps) {
  const [mounted, setMounted] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const workspaceLists = useTaskStore((s) => s.workspaceLists);
  const listItems = useTaskStore((s) => s.listItems);
  const toggleListItem = useTaskStore((s) => s.toggleListItem);
  const addListItem = useTaskStore((s) => s.addListItem);
  const hydrateWorkspaceListData = useTaskStore((s) => s.hydrateWorkspaceListData);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setNewItemText("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        triggerHaptic("light");
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !target) return;
    void hydrateWorkspaceListData(target.workspaceId);
  }, [isOpen, target, hydrateWorkspaceListData]);

  const list = useMemo(() => {
    if (!target) return undefined;
    return workspaceLists.find(
      (l) => l.id === target.listId && l.workspaceId === target.workspaceId,
    );
  }, [target, workspaceLists]);

  const displayTitle = list?.title ?? target?.title ?? "Untitled list";
  const displayColor = list?.color ?? target?.color ?? "default";

  const items = useMemo(() => {
    if (!target) return [];
    return listItems
      .filter((i) => i.listId === target.listId && i.workspaceId === target.workspaceId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [target, listItems]);

  const openCount = items.filter((i) => !i.completed).length;
  const colorStyle = getListColorStyle(displayColor);

  const handleToggle = async (itemId: string) => {
    triggerHaptic("light");
    await toggleListItem(itemId);
    onItemsChanged?.();
  };

  const handleAddItem = async () => {
    if (!target) return;
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    await addListItem(target.listId, trimmed);
    setNewItemText("");
    onItemsChanged?.();
  };

  const handleClose = () => {
    triggerHaptic("light");
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && target && (
        <div
          className="fixed inset-0 z-[180] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-list-modal-title"
            className={cn(
              "glass w-full flex flex-col overflow-hidden border border-white/10 shadow-2xl",
              "max-h-[min(88vh,640px)] rounded-t-3xl md:rounded-2xl md:max-w-md",
            )}
            style={{
              background: colorStyle.bg,
              borderColor: colorStyle.border,
            }}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="sheet-drag-handle md:hidden shrink-0" aria-hidden="true" />

            <header className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] text-[#71717a] uppercase tracking-wider mb-1">
                  <ListChecks className="h-3 w-3 text-[#c084fc]" />
                  {target.workspaceName}
                </div>
                <h2
                  id="home-list-modal-title"
                  className="text-lg font-semibold text-[#f4f4f5] truncate"
                >
                  {displayTitle}
                </h2>
                {items.length > 0 && (
                  <p className="text-[11px] text-[#71717a] mt-1">
                    {openCount === 0 ? "All done" : `${openCount} left`}
                  </p>
                )}
                {onOpenInWorkspace && (
                  <WorkspaceItemDeepLink
                    workspaceName={target.workspaceName}
                    destination="Lists"
                    onNavigate={onOpenInWorkspace}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-[#71717a] hover:text-white hover:bg-white/10 transition"
                aria-label="Close list"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
              {items.length === 0 ? (
                <p className="text-sm text-[#71717a] text-center py-8">
                  No items yet — add one below.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <li key={item.id} className="list-item-row">
                      <button
                        type="button"
                        onClick={() => void handleToggle(item.id)}
                        className={cn("list-item-check", item.completed && "is-done")}
                        aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        {item.completed && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </button>
                      <span
                        className={cn(
                          "list-item-text flex-1",
                          item.completed && "is-done",
                        )}
                      >
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="shrink-0 border-t border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAddItem();
                    }
                  }}
                  placeholder="Add an item…"
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-[#f4f4f5] outline-none placeholder:text-[#52525b] focus:border-[#c084fc]/40"
                  aria-label="New list item"
                />
                <button
                  type="button"
                  onClick={() => void handleAddItem()}
                  disabled={!newItemText.trim()}
                  className="shrink-0 rounded-xl bg-[#c084fc] text-black text-xs font-medium px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}