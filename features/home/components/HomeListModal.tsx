"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, PanInfo, useDragControls } from "framer-motion";
import { Check } from "lucide-react";
import { WorkspaceItemDeepLink } from "@/components/WorkspaceItemDeepLink";
import { cn, triggerHaptic } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";
import { getListColorStyle } from "@/store/listSlice";
import "../home-workspace.css";

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

const SHEET_SPRING = { type: "spring" as const, damping: 32, stiffness: 380, mass: 0.85 };

export function HomeListModal({
  target,
  isOpen,
  onClose,
  onItemsChanged,
  onOpenInWorkspace,
}: HomeListModalProps) {
  const [mounted, setMounted] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  const [dragY, setDragY] = useState(0);
  const dragControls = useDragControls();

  const workspaceLists = useTaskStore((s) => s.workspaceLists);
  const listItems = useTaskStore((s) => s.listItems);
  const toggleListItem = useTaskStore((s) => s.toggleListItem);
  const addListItem = useTaskStore((s) => s.addListItem);
  const hydrateWorkspaceListData = useTaskStore((s) => s.hydrateWorkspaceListData);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setNewItemText("");
      setDragY(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isMobile) {
      triggerHaptic("light");
    }
  }, [isOpen, isMobile]);

  const handleClose = useCallback(() => {
    triggerHaptic("light");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };

    const prevOverflow = document.body.style.overflow;
    if (isMobile) {
      document.body.style.overflow = "hidden";
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, isMobile, handleClose]);

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

  const openItems = useMemo(() => items.filter((i) => !i.completed), [items]);
  const doneItems = useMemo(() => items.filter((i) => i.completed), [items]);
  const colorStyle = getListColorStyle(displayColor);

  const handleToggle = async (itemId: string) => {
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

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) {
      handleClose();
    } else {
      setDragY(0);
    }
  };

  const startSheetDrag = (e: React.PointerEvent) => {
    dragControls.start(e);
  };

  const renderItem = (item: (typeof items)[number]) => (
    <li key={item.id} className="home-list-item-row">
      <button
        type="button"
        onClick={() => void handleToggle(item.id)}
        className={cn("home-list-item-check", item.completed && "is-done")}
        aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
      >
        {item.completed && <Check className="h-3 w-3 stroke-[3]" />}
      </button>
      <span className={cn("home-list-item-text", item.completed && "is-done")}>{item.text}</span>
    </li>
  );

  const canAdd = !!newItemText.trim();

  const addItemSection = (
    <div className="home-list-add shrink-0 px-4 py-3 border-b border-white/10 space-y-2">
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
        className="input w-full text-sm px-3 py-2.5 rounded-xl min-h-0"
        aria-label="Add an item"
      />
      <button
        type="button"
        onClick={() => void handleAddItem()}
        disabled={!canAdd}
        className={cn(
          "home-list-add-btn w-full rounded-xl text-sm font-medium px-4 py-2.5 transition",
          canAdd ? "btn btn-primary" : "btn btn-secondary opacity-45",
        )}
      >
        Add
      </button>
    </div>
  );

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence onExitComplete={() => setDragY(0)}>
      {isOpen && target && (
        <div
          className={cn(
            "fixed inset-0 z-[200]",
            isMobile ? "flex flex-col justify-end" : "flex items-center justify-center p-4",
          )}
        >
          <motion.div
            key="home-list-backdrop"
            className={cn("absolute inset-0", isMobile ? "sheet-backdrop" : "bg-black/70 backdrop-blur-sm")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={handleClose}
            aria-hidden="true"
          />

          <motion.div
            key="home-list-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-list-modal-title"
            className={cn(
              "home-list-modal glass w-full overflow-hidden flex flex-col border shadow-2xl",
              isMobile
                ? "home-list-drawer-sheet mobile-bottom-sheet relative h-[92dvh] max-h-[92dvh] rounded-t-3xl max-w-none"
                : "relative max-w-md max-h-[min(80vh,560px)] rounded-2xl",
            )}
            style={{
              background: colorStyle.bg,
              borderColor: colorStyle.border,
            }}
            onClick={(e) => e.stopPropagation()}
            drag={isMobile ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 500 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={isMobile ? handleDragEnd : undefined}
            onDrag={(_e, info) => {
              if (isMobile) setDragY(Math.max(0, info.offset.y));
            }}
            initial={isMobile ? { y: "100%" } : { scale: 0.96, opacity: 0 }}
            animate={isMobile ? { y: dragY } : { scale: 1, opacity: 1 }}
            exit={isMobile ? { y: "100%" } : { scale: 0.96, opacity: 0 }}
            transition={SHEET_SPRING}
          >
            {isMobile && (
              <div
                className="sheet-drag-handle shrink-0 touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={startSheetDrag}
                aria-hidden="true"
              />
            )}

            <header className="home-list-header shrink-0 flex items-start justify-between gap-3 px-4 py-3 border-b border-white/10">
              <div className="min-w-0 flex-1">
                <h2
                  id="home-list-modal-title"
                  className="text-xl font-semibold text-[#f4f4f5] leading-snug break-words"
                >
                  {displayTitle}
                </h2>
                <p className="text-xs text-[#71717a] mt-1">
                  {target.workspaceName}
                  {items.length > 0 && (
                    <span>
                      {" "}
                      · {openItems.length === 0 ? "All done" : `${openItems.length} left`}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="home-list-close shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition active:scale-[0.98]"
                aria-label="Close list"
              >
                Close
              </button>
            </header>

            {addItemSection}

            <div className="home-list-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
              {items.length === 0 ? (
                <p className="text-sm text-[#71717a] text-center py-10">No items yet.</p>
              ) : (
                <ul className="space-y-1">
                  {openItems.map(renderItem)}
                  {doneItems.length > 0 && openItems.length > 0 && (
                    <li className="home-list-done-divider" aria-hidden="true" />
                  )}
                  {doneItems.map(renderItem)}
                </ul>
              )}
            </div>

            {!isMobile && onOpenInWorkspace && (
              <footer className="home-list-footer shrink-0 border-t border-white/10 px-4 py-3">
                <WorkspaceItemDeepLink
                  workspaceName={target.workspaceName}
                  destination="Lists"
                  onNavigate={onOpenInWorkspace}
                  className="inline-flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#c084fc] transition w-full justify-center py-1"
                />
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}