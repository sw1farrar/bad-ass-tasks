"use client";

import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Check, CornerDownRight, CornerLeftUp, GripVertical, Pencil, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { cn } from "@/lib/utils";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import type { ListItem } from "@/types";

const INDENT_STEP_REM = 1.25;

function syncTextareaHeight(el: HTMLTextAreaElement) {
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
}

interface ListItemRowProps {
  item: ListItem;
  depth?: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onIndent?: (id: string) => void;
  onOutdent?: (id: string) => void;
  canIndent?: boolean;
  canOutdent?: boolean;
  readOnly?: boolean;
  sortable?: boolean;
  insertBelowOnEnter?: boolean;
  onInsertBelow?: (id: string) => void;
  registerInputRef?: (el: HTMLTextAreaElement | null) => void;
  /** Rendered in the completed section below the divider */
  completedSection?: boolean;
  /** Mobile list detail modal — show edit pencil that selects all on tap */
  showEditPencil?: boolean;
  /** Mobile detail — row selected for action buttons (parent-controlled) */
  isRowActive?: boolean;
  onRowActivate?: (id: string | null) => void;
}

export function ListItemRow({
  item,
  depth = 0,
  onToggle,
  onDelete,
  onTextChange,
  onIndent,
  onOutdent,
  canIndent = true,
  canOutdent = true,
  readOnly = false,
  sortable = true,
  insertBelowOnEnter = false,
  onInsertBelow,
  registerInputRef,
  completedSection = false,
  showEditPencil = false,
  isRowActive = false,
  onRowActivate,
}: ListItemRowProps) {
  const [focused, setFocused] = useState(false);
  const [titleEditMode, setTitleEditMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelectAllRef = useRef(false);
  const isMobile = useIsMobileViewport();
  const showTitleAsLabel =
    showEditPencil && !titleEditMode && item.text.trim().length > 0;
  const isRowFocused = !readOnly && (showEditPencil ? isRowActive || titleEditMode : focused);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !sortable || readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    paddingLeft: depth > 0 ? `${depth * INDENT_STEP_REM}rem` : undefined,
  };

  const setTextareaRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el;
      registerInputRef?.(el);
      if (el) syncTextareaHeight(el);
    },
    [registerInputRef],
  );

  useLayoutEffect(() => {
    if (textareaRef.current) syncTextareaHeight(textareaRef.current);
  }, [item.text]);

  useLayoutEffect(() => {
    if (showEditPencil && !item.text.trim()) {
      setTitleEditMode(true);
    }
  }, [showEditPencil, item.id, item.text]);

  const applySelectAll = useCallback(() => {
    const input = textareaRef.current;
    if (!input) return;
    input.focus();
    const selectAll = () => {
      input.setSelectionRange(0, input.value.length);
      syncTextareaHeight(input);
      if (isMobile) {
        input.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };
    // Double rAF helps iOS apply the selection after the textarea mounts/focuses
    requestAnimationFrame(() => {
      selectAll();
      requestAnimationFrame(selectAll);
    });
  }, [isMobile]);

  useLayoutEffect(() => {
    if (!titleEditMode || !pendingSelectAllRef.current) return;
    const input = textareaRef.current;
    if (!input) return;

    pendingSelectAllRef.current = false;
    applySelectAll();
  }, [titleEditMode, applySelectAll]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const input = e.currentTarget;
      const cursorAtEnd =
        input.selectionStart === input.value.length &&
        input.selectionEnd === input.value.length;
      if (insertBelowOnEnter && cursorAtEnd && onInsertBelow) {
        onInsertBelow(item.id);
        return;
      }
      input.blur();
      return;
    }
    if (e.key === "Tab" && !readOnly) {
      e.preventDefault();
      if (e.shiftKey) {
        if (canOutdent) onOutdent?.(item.id);
      } else if (canIndent) {
        onIndent?.(item.id);
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (showEditPencil && !titleEditMode) {
      e.currentTarget.blur();
      return;
    }
    setFocused(true);
    const input = e.currentTarget;
    requestAnimationFrame(() => {
      syncTextareaHeight(input);
      if (isMobile) {
        input.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  };

  const focusAndSelectAll = useCallback(() => {
    onRowActivate?.(item.id);
    setFocused(true);

    if (textareaRef.current) {
      applySelectAll();
      return;
    }

    pendingSelectAllRef.current = true;
    setTitleEditMode(true);
  }, [item.id, onRowActivate, applySelectAll]);

  const focusItemInput = (row: HTMLElement) => {
    const input = row.querySelector<HTMLTextAreaElement>(".list-item-text");
    input?.focus();
  };

  const handleRowPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;
    if (showEditPencil) {
      onRowActivate?.(item.id);
      return;
    }
    setFocused(true);
    focusItemInput(e.currentTarget);
  };

  const keepFocusForRowControl = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const input = e.currentTarget;
    const row = input.closest(".list-item-row");
    const trimmed = input.value.trim();
    const related = e.relatedTarget as Node | null;

    if (row && related && row.contains(related)) {
      return;
    }

    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (row && active && row.contains(active)) {
        return;
      }

      setFocused(false);
      setTitleEditMode(false);
      onRowActivate?.(null);

      if (!trimmed) {
        if (!isMobile) onDelete(item.id);
      } else if (trimmed !== item.text) {
        onTextChange(item.id, trimmed);
      }
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "list-item-row group",
        completedSection && "list-item-row--completed-section",
        isDragging && sortable && "is-dragging-source",
        isRowFocused && "is-row-focused",
      )}
      data-no-open={readOnly ? undefined : true}
      onPointerDown={handleRowPointerDown}
    >
      {sortable && !readOnly && (
        <button
          type="button"
          className="list-item-drag shrink-0 text-text-secondary cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className={cn("list-item-check", item.completed && "is-done")}
        aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
        data-no-open
      >
        {item.completed && <Check className="h-2.5 w-2.5 stroke-[3]" />}
      </button>
      {readOnly ? (
        <span
          className={cn(
            "list-item-text bg-transparent outline-none border-none w-full",
            item.completed && "is-done",
          )}
        >
          {item.text}
        </span>
      ) : (
        <div className="list-item-text-field">
          {showTitleAsLabel ? (
            <span
              className={cn(
                "list-item-text list-item-text--display block w-full",
                item.completed && "is-done",
              )}
            >
              {item.text}
            </span>
          ) : (
            <textarea
              ref={setTextareaRef}
              rows={1}
              value={item.text}
              onChange={(e) => {
                onTextChange(item.id, e.target.value);
                syncTextareaHeight(e.target);
              }}
              onFocus={handleFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              enterKeyHint={insertBelowOnEnter ? "next" : "done"}
              readOnly={showEditPencil && !titleEditMode}
              tabIndex={showEditPencil && !titleEditMode ? -1 : undefined}
              className={cn(
                "list-item-text list-item-text--editable bg-transparent outline-none border-none w-full",
                item.completed && "is-done",
              )}
              aria-label="List item"
            />
          )}
        </div>
      )}
      {!readOnly && (
        <div className="list-item-actions shrink-0 flex items-center">
          {canOutdent ? (
            <button
              type="button"
              onMouseDown={keepFocusForRowControl}
              onClick={() => onOutdent?.(item.id)}
              className="list-item-indent-btn shrink-0 text-text-secondary hover:text-neon-purple transition"
              aria-label="Outdent item"
              title="Outdent (Shift+Tab)"
            >
              <CornerLeftUp className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {canIndent ? (
            <button
              type="button"
              onMouseDown={keepFocusForRowControl}
              onClick={() => canIndent && onIndent?.(item.id)}
              className="list-item-indent-btn shrink-0 text-text-secondary hover:text-neon-purple transition"
              aria-label="Indent item"
              title="Indent (Tab)"
            >
              <CornerDownRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {showEditPencil ? (
            <button
              type="button"
              onMouseDown={keepFocusForRowControl}
              onClick={(e) => {
                e.stopPropagation();
                focusAndSelectAll();
              }}
              className="list-item-edit-btn shrink-0"
              aria-label="Edit item name"
              title="Edit name"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onMouseDown={keepFocusForRowControl}
            onClick={() => setDeleteConfirmOpen(true)}
            className="list-item-delete shrink-0 text-text-faint hover:text-[var(--priority-p0)] transition"
            aria-label="Remove item"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <ConfirmationModal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Remove list item?"
        description="This item will be permanently removed from the list."
        highlight={item.text.trim() || "Untitled item"}
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={() => onDelete(item.id)}
      />
    </div>
  );
}