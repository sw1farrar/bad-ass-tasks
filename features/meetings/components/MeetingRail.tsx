"use client";

import React from "react";
import { Archive, ArchiveRestore, Loader2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingRailProps {
  isDesktop?: boolean;
  onNewMeeting: () => void;
  isCreating?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  libraryView?: "active" | "archived";
  onLibraryViewChange?: (view: "active" | "archived") => void;
  archivedCount?: number;
  listContent?: React.ReactNode;
}

export function MeetingRail({
  isDesktop = false,
  onNewMeeting,
  isCreating,
  searchQuery = "",
  onSearchQueryChange,
  libraryView = "active",
  onLibraryViewChange,
  archivedCount = 0,
  listContent,
}: MeetingRailProps) {
  if (!isDesktop) return null;

  const isArchivedView = libraryView === "archived";

  return (
    <aside
      className="files-browse-panel w-80 xl:w-[22rem] shrink-0 border-r border-border-glass bg-bg flex flex-col min-h-0 gap-3"
      aria-label="Meetings browse"
    >
      <div className="files-browse-toolbar files-action-bar shrink-0 p-4 border-b border-border-glass space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              placeholder={isArchivedView ? "Search archived…" : "Search meetings…"}
              className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
              aria-label={isArchivedView ? "Search archived meetings" : "Search meetings"}
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isArchivedView && (
              <button
                type="button"
                onClick={onNewMeeting}
                disabled={isCreating}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neon-purple/30 bg-neon-purple/10 text-neon-purple-tint transition hover:bg-neon-purple/15 active:scale-95 disabled:opacity-50"
                aria-label="New meeting"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                )}
              </button>
            )}
            {onLibraryViewChange && (
              <button
                type="button"
                onClick={() =>
                  onLibraryViewChange(isArchivedView ? "active" : "archived")
                }
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-95",
                  isArchivedView
                    ? "border-neon-purple/40 bg-neon-purple/15 text-neon-purple-tint"
                    : "border-border-glass bg-bg-secondary text-text-muted hover:text-text-primary hover:bg-surface-hover",
                )}
                aria-pressed={isArchivedView}
                aria-label={
                  isArchivedView
                    ? "Back to active meetings"
                    : archivedCount > 0
                      ? `View archived meetings (${archivedCount})`
                      : "View archived meetings"
                }
              >
                {isArchivedView ? (
                  <ArchiveRestore className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="files-browse-list-shell flex-1 min-h-0 flex flex-col">{listContent}</div>
    </aside>
  );
}
