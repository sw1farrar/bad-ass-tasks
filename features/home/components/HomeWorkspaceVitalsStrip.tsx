"use client";

import React from "react";
import { Check, FolderOpen, ListChecks, type LucideIcon } from "lucide-react";
import { cn, triggerHaptic } from "@/lib/utils";

interface HomeWorkspaceVitalsStripProps {
  openTasks: number;
  overdue: number;
  listCount: number;
  pendingReviewCount: number;
  className?: string;
  onTasksClick?: () => void;
  onListsClick?: () => void;
  onReviewClick?: () => void;
}

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

function VitalIconButton({
  icon: Icon,
  count,
  onClick,
  ariaLabel,
  highlightOverdue,
}: {
  icon: LucideIcon;
  count: number;
  onClick?: () => void;
  ariaLabel: string;
  highlightOverdue?: boolean;
}) {
  const showBadge = count > 0;
  const body = (
    <span className="home-ws-vitals__icon-wrap">
      <Icon className="home-ws-vitals__icon" aria-hidden />
      {showBadge ? (
        <span
          className={cn(
            "nav-count-badge nav-count-badge--bottom home-ws-vitals__badge",
            highlightOverdue && "nav-count-badge--overdue",
          )}
          aria-hidden
        >
          {highlightOverdue ? <span className="nav-count-badge__pulse" aria-hidden /> : null}
          {formatCount(count)}
        </span>
      ) : null}
    </span>
  );

  if (!onClick) {
    return (
      <span className="home-ws-vitals__icon-static" aria-label={ariaLabel} title={ariaLabel}>
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="home-ws-vitals__icon-btn"
      onClick={(e) => {
        e.stopPropagation();
        triggerHaptic("light");
        onClick();
      }}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {body}
    </button>
  );
}

export function HomeWorkspaceVitalsStrip({
  openTasks,
  overdue,
  listCount,
  pendingReviewCount,
  className,
  onTasksClick,
  onListsClick,
  onReviewClick,
}: HomeWorkspaceVitalsStripProps) {
  return (
    <div
      className={cn("home-ws-vitals home-ws-vitals--icons", className)}
      aria-label="Workspace summary"
    >
      <VitalIconButton
        icon={Check}
        count={openTasks}
        onClick={onTasksClick}
        highlightOverdue={overdue > 0 && openTasks > 0}
        ariaLabel={`${openTasks} open task${openTasks === 1 ? "" : "s"} — open tasks`}
      />
      <VitalIconButton
        icon={ListChecks}
        count={listCount}
        onClick={onListsClick}
        ariaLabel={`${listCount} ${listCount === 1 ? "list" : "lists"} in workspace — open lists`}
      />
      <VitalIconButton
        icon={FolderOpen}
        count={pendingReviewCount}
        onClick={onReviewClick}
        ariaLabel={
          pendingReviewCount > 0
            ? `Review ${pendingReviewCount} file${pendingReviewCount === 1 ? "" : "s"}`
            : "No files to review — open files"
        }
      />
    </div>
  );
}