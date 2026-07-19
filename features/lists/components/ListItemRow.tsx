"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, CirclePause } from "lucide-react";

import { ConfirmationModal } from "@/components/ConfirmationModal";
import { cn } from "@/lib/utils";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import type { ListItemFamilyChrome } from "@/lib/lists/listDragPreview";
import type { ListItem } from "@/types";
import { ListItemActionsMenu } from "./ListItemActionsMenu";
import type { ListItemMoveTarget } from "./ListItemMoveMenu";

export const LIST_ITEM_INDENT_STEP_REM = 1.625;

function syncTextareaHeight(el: HTMLTextAreaElement) {
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
}

interface ListItemRowProps {
  /** Subtle indicator that this item has a pending outbox write. */
  syncPending?: boolean;
  item: ListItem;
  depth?: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onIndent?: (id: string) => void;
  onOutdent?: (id: string) => void;
  canIndent?: boolean;
  canOutdent?: boolean;
  showReorderNudges?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  readOnly?: boolean;
  insertBelowOnEnter?: boolean;
  onInsertBelow?: (id: string) => void;
  registerInputRef?: (el: HTMLTextAreaElement | null) => void;
  /** Rendered in the completed section below the divider */
  completedSection?: boolean;
  /** Rendered in the pending parked section */
  pendingSection?: boolean;
  /** Park this item in the pending bucket */
  onSetPending?: (id: string) => void;
  /** Mobile list detail modal — show edit pencil that selects all on tap */
  showEditPencil?: boolean;
  /** Desktop detail — tap the item text (not the row) to edit with select-all */
  clickTitleToEdit?: boolean;
  /** Detail view — row selected for quick actions (parent-controlled) */
  isRowActive?: boolean;
  onRowActivate?: (id: string | null) => void;
  /** Keep selection visible without requiring text focus */
  rowSelectionMode?: boolean;
  moveTargetLists?: ListItemMoveTarget[];
  onMoveToList?: (itemId: string, targetListId: string) => void;
  actionsMenuOpen?: boolean;
  onActionsMenuOpenChange?: (open: boolean) => void;
  /** Rendered inside a family group container (shared border with parent/children) */
  inFamily?: boolean;
  nestedInFamily?: boolean;
  /** Flat drag layout — family border chrome on the row itself */
  familyChrome?: ListItemFamilyChrome;
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
  showReorderNudges = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  readOnly = false,
  insertBelowOnEnter = false,
  onInsertBelow,
  registerInputRef,
  completedSection = false,
  pendingSection = false,
  onSetPending,
  showEditPencil = false,
  clickTitleToEdit = false,
  isRowActive = false,
  onRowActivate,
  rowSelectionMode = false,
  moveTargetLists = [],
  onMoveToList,
  actionsMenuOpen = false,
  onActionsMenuOpenChange,
  inFamily = false,
  nestedInFamily = false,
  familyChrome,
  syncPending = false,
}: ListItemRowProps) {
  const [focused, setFocused] = useState(false);
  const [titleEditMode, setTitleEditMode] = useState(false);
  const [localText, setLocalText] = useState(item.text);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelectAllRef = useRef(false);
  const selectAllOnActivateRef = useRef(false);
  const isMobile = useIsMobileViewport();
  const useTitleDisplayMode = showEditPencil || clickTitleToEdit;
  const isEditingText = focused || titleEditMode;
  const showTitleAsLabel =
    useTitleDisplayMode &&
    !titleEditMode &&
    item.text.trim().length > 0;
  const isRowFocused =
    !readOnly &&
    (isRowActive ||
      actionsMenuOpen ||
      (showEditPencil ? titleEditMode : clickTitleToEdit ? titleEditMode : focused));
  const showActionsMenu = !readOnly && !!onActionsMenuOpenChange;
  const showPendingButton =
    !!onSetPending && !item.pending && !item.completed && !pendingSection;

  const selectRow = useCallback(() => {
    onRowActivate?.(item.id);
  }, [item.id, onRowActivate]);

  useEffect(() => {
    if (!isEditingText) {
      setLocalText(item.text);
    }
  }, [item.id, item.text, isEditingText]);

  const useFlatChrome = !!familyChrome;
  const inFamilyGroup = inFamily && !useFlatChrome;
  const nestedInFamilyRow =
    nestedInFamily || (useFlatChrome && !!familyChrome?.isNestedInFamily);

  const depthStyle = {
    ["--list-item-depth" as string]: depth,
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
  }, [localText, item.text, isEditingText]);

  useLayoutEffect(() => {
    if (useTitleDisplayMode && !item.text.trim()) {
      setTitleEditMode(true);
    }
  }, [useTitleDisplayMode, item.id, item.text]);

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
    if (useTitleDisplayMode && !titleEditMode) {
      e.currentTarget.blur();
      return;
    }
    setFocused(true);
    const input = e.currentTarget;

    if (selectAllOnActivateRef.current || pendingSelectAllRef.current) {
      selectAllOnActivateRef.current = false;
      pendingSelectAllRef.current = false;
      const selectAll = () => input.setSelectionRange(0, input.value.length);
      selectAll();
      requestAnimationFrame(() => {
        selectAll();
        requestAnimationFrame(selectAll);
      });
    }

    requestAnimationFrame(() => {
      syncTextareaHeight(input);
      if (isMobile) {
        input.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  };

  const activateTitleEdit = useCallback(() => {
    if (showEditPencil) onRowActivate?.(item.id);
    setLocalText(item.text);
    setFocused(true);
    selectAllOnActivateRef.current = true;
    pendingSelectAllRef.current = true;

    if (textareaRef.current) {
      applySelectAll();
      selectAllOnActivateRef.current = false;
      pendingSelectAllRef.current = false;
      return;
    }

    setTitleEditMode(true);
  }, [item.text, showEditPencil, onRowActivate, applySelectAll]);

  const titleTapOriginRef = useRef<{ x: number; y: number } | null>(null);

  const handleTitleLabelPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0 || !useTitleDisplayMode) return;
    if (isMobile && showEditPencil) {
      titleTapOriginRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    activateTitleEdit();
  };

  const handleTitleLabelPointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!isMobile || !showEditPencil || !titleTapOriginRef.current) return;
    const origin = titleTapOriginRef.current;
    titleTapOriginRef.current = null;
    const dx = Math.abs(e.clientX - origin.x);
    const dy = Math.abs(e.clientY - origin.y);
    if (dx > 10 || dy > 10) return;
    activateTitleEdit();
  };

  const focusItemInput = (row: HTMLElement) => {
    const input = row.querySelector<HTMLTextAreaElement>(".list-item-text");
    input?.focus();
  };

  const handleRowPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;
    if (rowSelectionMode || showEditPencil) {
      onRowActivate?.(item.id);
      if (clickTitleToEdit || showEditPencil) return;
    }
    if (clickTitleToEdit) return;
    setFocused(true);
    focusItemInput(e.currentTarget);
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
      if (!rowSelectionMode && !actionsMenuOpen) {
        onRowActivate?.(null);
      }

      if (!trimmed) {
        onDelete(item.id);
      } else if (trimmed !== item.text) {
        onTextChange(item.id, trimmed);
      }
    });
  };

  return (
    <div
      style={depthStyle}
      className={cn(
        "list-item-row group",
        (inFamilyGroup || useFlatChrome) && "list-item-row--in-family",
        nestedInFamilyRow && "list-item-row--nested",
        useFlatChrome && "list-item-row--flat-family",
        familyChrome?.isFamilyRoot && "list-item-row--family-root",
        familyChrome?.isFamilyLast && "list-item-row--family-last",
        familyChrome?.isSoloFamily && "list-item-row--family-solo",
        completedSection && "list-item-row--completed-section",
        pendingSection && "list-item-row--pending-section",
        isRowFocused && "is-row-focused",
        isRowActive && "is-row-selected",
        actionsMenuOpen && "is-actions-menu-open",
      )}
      data-list-item-id={item.id}
      data-no-open={readOnly ? undefined : true}
      onPointerDown={handleRowPointerDown}
    >
      <button
        type="button"
        onClick={() => {
          selectRow();
          onToggle(item.id);
        }}
        className={cn(
          "list-item-check",
          item.completed && "is-done",
          syncPending && "is-sync-pending",
        )}
        aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
        title={syncPending ? "Saving…" : undefined}
        data-no-open
      >
        {item.completed && <Check className="list-item-check-icon" strokeWidth={3} />}
      </button>

      <div className="list-item-row-content" style={depthStyle}>
        {readOnly ? (
          <div className="list-item-text-field">
            <span
              className={cn(
                "list-item-text bg-transparent outline-none border-none w-full",
                item.completed && "is-done",
              )}
            >
              {item.text}
            </span>
          </div>
        ) : (
          <div
            className={cn(
              "list-item-text-field",
              showTitleAsLabel && "list-item-text-field--display",
            )}
          >
            {showTitleAsLabel ? (
              <span
                className={cn(
                  "list-item-text list-item-text--display",
                  useTitleDisplayMode && "list-item-text--display-clickable",
                  item.completed && "is-done",
                )}
                onPointerDown={useTitleDisplayMode ? handleTitleLabelPointerDown : undefined}
                onPointerUp={useTitleDisplayMode ? handleTitleLabelPointerUp : undefined}
                onPointerCancel={() => {
                  titleTapOriginRef.current = null;
                }}
              >
                {item.text.trim() || (isMobile && showEditPencil ? "New item" : item.text)}
              </span>
            ) : (
              <textarea
                ref={setTextareaRef}
                rows={1}
                value={localText}
                onChange={(e) => {
                  setLocalText(e.target.value);
                  syncTextareaHeight(e.target);
                }}
                onMouseDown={(e) => {
                  if (selectAllOnActivateRef.current || pendingSelectAllRef.current) {
                    e.preventDefault();
                  }
                }}
                onFocus={handleFocus}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                enterKeyHint={insertBelowOnEnter ? "next" : "done"}
                readOnly={useTitleDisplayMode && !titleEditMode}
                tabIndex={useTitleDisplayMode && !titleEditMode ? -1 : undefined}
                className={cn(
                  "list-item-text list-item-text--editable bg-transparent outline-none border-none w-full",
                  item.completed && "is-done",
                )}
                aria-label="List item"
              />
            )}
          </div>
        )}
      </div>

      {showPendingButton ? (
        <button
          type="button"
          className="list-item-pending-btn"
          aria-label="Move to pending"
          data-no-open
          onClick={() => {
            selectRow();
            onSetPending?.(item.id);
          }}
        >
          <CirclePause className="list-item-pending-icon" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}

      {showActionsMenu ? (
        <ListItemActionsMenu
          open={actionsMenuOpen}
          onOpenChange={onActionsMenuOpenChange}
          onMenuInteract={selectRow}
          showReorder={showReorderNudges}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={() => canMoveUp && onMoveUp?.(item.id)}
          onMoveDown={() => canMoveDown && onMoveDown?.(item.id)}
          canIndent={canIndent}
          canOutdent={canOutdent}
          onIndent={() => canIndent && onIndent?.(item.id)}
          onOutdent={() => canOutdent && onOutdent?.(item.id)}
          moveTargetLists={moveTargetLists}
          onMoveToList={(targetListId) => onMoveToList?.(item.id, targetListId)}
          showEdit={showEditPencil}
          onEdit={activateTitleEdit}
          onDelete={() => setDeleteConfirmOpen(true)}
        />
      ) : null}

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