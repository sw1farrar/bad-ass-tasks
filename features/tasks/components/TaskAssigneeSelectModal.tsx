"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Search, User, X } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import {
  TASK_ASSIGNEE_ALL_LABEL,
  getMemberDisplayName,
  getMemberMentionHandle,
  memberMatchesMentionQuery,
} from "@/lib/assignee";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn, getNameInitials } from "@/lib/utils";
import type { WorkspaceMember } from "@/types";

interface TaskAssigneeSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle?: string;
  members: WorkspaceMember[];
  currentUserId?: string;
  selectedUserId?: string | null;
  onSelectAssignee: (userId: string | null) => void | Promise<void>;
}

function SelectBody({
  taskTitle,
  members,
  currentUserId,
  selectedUserId,
  onSelectAssignee,
  onClose,
}: Omit<TaskAssigneeSelectModalProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchRef.current) return;
    const id = window.requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  const query = search.trim().toLowerCase();
  const showAnyoneOption =
    !query ||
    query.includes("anyone") ||
    query.includes("all") ||
    query.includes("unassign") ||
    query === "—" ||
    query === "none";

  const filteredMembers = useMemo(() => {
    const list = query
      ? members.filter((member) => memberMatchesMentionQuery(member, query, currentUserId))
      : members;

    return [...list].sort((a, b) =>
      getMemberDisplayName(a, currentUserId).localeCompare(
        getMemberDisplayName(b, currentUserId),
        undefined,
        { sensitivity: "base" },
      ),
    );
  }, [members, query, currentUserId]);

  const handleSelect = async (userId: string | null) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSelectAssignee(userId);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const optionClass = (active: boolean) =>
    cn(
      "task-assignee-select__option flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition min-h-[44px]",
      active
        ? "border-neon-purple/45 bg-neon-purple/12 text-neon-purple"
        : "border-border-glass bg-surface-hover/50 text-text-primary hover:border-neon-purple/30 hover:bg-surface-hover",
    );

  return (
    <div className="task-assignee-select__body space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-text-primary tracking-tight">
            Choose assignee
          </h3>
          {taskTitle ? (
            <p
              className="mt-1 truncate text-sm leading-relaxed text-text-secondary"
              title={taskTitle}
            >
              {taskTitle}
            </p>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              Assign this task to a workspace member.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-hover hover:text-text-primary"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="task-assignee-select__search relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          className="input w-full py-2.5 pl-9 pr-3 text-sm min-h-[44px]"
          aria-label="Search workspace members"
          disabled={isSaving}
        />
      </div>

      <div className="task-assignee-select__list max-h-[min(40vh,16rem)] space-y-1.5 overflow-y-auto">
        {showAnyoneOption ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSelect(null)}
            className={optionClass(!selectedUserId)}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border-glass bg-surface-hover text-text-muted">
              <User className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">{TASK_ASSIGNEE_ALL_LABEL}</span>
            {!selectedUserId ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
          </button>
        ) : null}

        {filteredMembers.map((member) => {
          const active = selectedUserId === member.userId;
          const displayName = getMemberDisplayName(member, currentUserId);
          const handle = getMemberMentionHandle(member);
          const initials = getNameInitials(displayName === "You" ? "You" : member.fullName || displayName);

          return (
            <button
              key={member.userId}
              type="button"
              disabled={isSaving}
              onClick={() => void handleSelect(member.userId)}
              className={optionClass(active)}
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neon-purple/15 text-xs font-semibold text-neon-purple">
                {displayName === "You" ? "Y" : initials || displayName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{displayName}</span>
                {handle && displayName !== "You" ? (
                  <span className="block truncate text-[11px] font-normal text-text-muted">
                    @{handle}
                  </span>
                ) : null}
              </span>
              {active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
            </button>
          );
        })}

        {!showAnyoneOption && filteredMembers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-glass px-4 py-4 text-center text-sm text-text-muted">
            No members match &ldquo;{search.trim()}&rdquo;.
          </p>
        ) : null}

        {showAnyoneOption && filteredMembers.length === 0 && members.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-glass px-4 py-4 text-center text-sm text-text-muted">
            No workspace members found.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function TaskAssigneeSelectModal({
  open,
  onOpenChange,
  taskTitle,
  members,
  currentUserId,
  selectedUserId,
  onSelectAssignee,
}: TaskAssigneeSelectModalProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useScrollLock(open && !isMobile);

  useEffect(() => {
    if (!open || isMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, isMobile]);

  if (!open || !mounted) return null;

  const body = (
    <SelectBody
      taskTitle={taskTitle}
      members={members}
      currentUserId={currentUserId}
      selectedUserId={selectedUserId}
      onSelectAssignee={onSelectAssignee}
      onClose={close}
    />
  );

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={close}
        title="Choose assignee"
        zIndex={850}
        panelClassName="task-assignee-select-modal"
        showClose={false}
        showDragHandle
        enableDragDismiss
        dragMode="handle"
        ariaLabel="Choose assignee"
      >
        {body}
      </BottomSheet>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[850] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 overlay-scrim backdrop-blur-[3px]"
        onClick={close}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose assignee"
        className={cn(
          "task-assignee-select-modal relative w-full bg-bg-panel border border-border-glass modal-panel shadow-2xl rounded-2xl md:max-w-md",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}