"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface WorkspaceViewHeaderProps {
  title: string;
  workspaceName: string;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** compact: Notes sidebar. inline: title row (Tasks/Lists). inline-centered: centered title row (Team). */
  variant?: "default" | "compact" | "inline" | "inline-centered";
  /** Hide the "Workspace" label on viewports below md (Tasks page mobile density). */
  hideWorkspaceLabelOnMobile?: boolean;
  /** Hide the workspace name badge on viewports below md (shown in top bar on phones). */
  hideWorkspaceNameOnMobile?: boolean;
  /** Hide meta line (e.g. task counts) on viewports below md. */
  hideMetaOnMobile?: boolean;
}

export function WorkspaceViewHeader({
  title,
  workspaceName,
  icon,
  description,
  meta,
  actions,
  className,
  variant = "default",
  hideWorkspaceLabelOnMobile = false,
  hideWorkspaceNameOnMobile = false,
  hideMetaOnMobile = false,
}: WorkspaceViewHeaderProps) {
  const workspaceLabel = workspaceName.trim() || "Loading…";

  const inlineTitleRow = (
    <>
      {icon ? <span className="shrink-0 text-[#c084fc]">{icon}</span> : null}
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight shrink-0">{title}</h1>
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-widest text-[#71717a] shrink-0",
          hideWorkspaceLabelOnMobile && "hidden md:inline",
        )}
      >
        Workspace
      </span>
      <span
        className={cn(
          "inline-flex min-w-0 max-w-full items-center rounded-lg border border-[#c084fc]/25 bg-[#c084fc]/8 px-2.5 py-0.5 text-xs sm:text-sm font-semibold tracking-tight text-[#e9d5ff] truncate",
          hideWorkspaceNameOnMobile && "hidden md:inline-flex",
        )}
        title={workspaceLabel}
      >
        {workspaceLabel}
      </span>
    </>
  );

  if (variant === "inline-centered") {
    return (
      <div className={cn("min-w-0 flex flex-col items-center text-center", className)}>
        <div className="flex flex-col items-center gap-1.5 min-w-0 max-w-full">
          <div className="flex items-center justify-center gap-2.5">
            {icon ? <span className="shrink-0 text-[#c084fc]">{icon}</span> : null}
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight shrink-0">{title}</h1>
          </div>
          {!hideWorkspaceNameOnMobile && (
            <span
              className="inline-flex max-w-full items-center rounded-lg border border-[#c084fc]/25 bg-[#c084fc]/8 px-2.5 py-0.5 text-xs sm:text-sm font-semibold tracking-tight text-[#e9d5ff] truncate"
              title={workspaceLabel}
            >
              {workspaceLabel}
            </span>
          )}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">{actions}</div>
        ) : null}
        {description ? (
          <p className="text-sm text-[#71717a] mt-3 leading-relaxed max-w-lg">{description}</p>
        ) : null}
        {meta ? (
          <p className={cn("text-sm text-[#71717a]", description ? "mt-1 text-xs font-mono" : "mt-2")}>
            {meta}
          </p>
        ) : null}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn("min-w-0", className)}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
            {inlineTitleRow}
          </div>
          {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
        {description ? (
          <p className="text-sm text-[#71717a] mt-1.5 leading-relaxed">{description}</p>
        ) : null}
        {meta ? (
          <p
            className={cn(
              "text-sm text-[#71717a]",
              description ? "mt-1 text-xs font-mono" : "mt-1",
              hideMetaOnMobile && "hidden md:block",
            )}
          >
            {meta}
          </p>
        ) : null}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("min-w-0", className)}>
        <div className="font-semibold tracking-tight">{title}</div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <span className="text-[9px] font-medium uppercase tracking-widest text-[#71717a] shrink-0">
            Workspace
          </span>
          <span
            className="truncate text-[11px] font-semibold text-[#e9d5ff]"
            title={workspaceLabel}
          >
            {workspaceLabel}
          </span>
        </div>
        {meta ? <div className="text-[10px] text-[#71717a] font-mono mt-0.5">{meta}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon ? <span className="shrink-0 text-[#c084fc]">{icon}</span> : null}
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-widest text-[#71717a] shrink-0">
            Workspace
          </span>
          <span
            className="inline-flex max-w-full items-center rounded-lg border border-[#c084fc]/25 bg-[#c084fc]/8 px-2.5 py-0.5 text-sm font-semibold tracking-tight text-[#e9d5ff] truncate"
            title={workspaceLabel}
          >
            {workspaceLabel}
          </span>
        </div>

        {description ? (
          <p className="text-sm text-[#71717a] mt-1.5 leading-relaxed">{description}</p>
        ) : null}
        {meta ? (
          <p className={cn("text-sm text-[#71717a]", description ? "mt-1 text-xs font-mono" : "mt-1.5")}>
            {meta}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}