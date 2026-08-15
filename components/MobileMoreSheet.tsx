"use client";

import React, { useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { BrandLogo } from "@/components/BrandLogo";
import { cn, triggerHaptic } from "@/lib/utils";
import {
  getMobileMoreNavGroups,
  type MobileMoreNavItem,
  type WorkspaceNavViewId,
} from "@/lib/nav/workspaceViews";
import type { Workspace } from "@/types";

export type MobileMoreSheetProps = {
  open: boolean;
  onClose: () => void;
  currentView: WorkspaceNavViewId | string;
  onNavigate: (view: WorkspaceNavViewId) => void;
  workspace: Workspace;
  showChat?: boolean;
  isSiteAdmin?: boolean;
  chatUnread?: boolean;
};

export function MobileMoreSheet({
  open,
  onClose,
  currentView,
  onNavigate,
  workspace,
  showChat = false,
  isSiteAdmin = false,
  chatUnread = false,
}: MobileMoreSheetProps) {
  const [query, setQuery] = useState("");

  const groups = useMemo(
    () => getMobileMoreNavGroups(workspace, { showChat, isSiteAdmin }),
    [workspace, showChat, isSiteAdmin],
  );

  const needle = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const label = (item.shortLabel ?? item.label).toLowerCase();
          return (
            label.includes(needle) ||
            item.label.toLowerCase().includes(needle) ||
            group.label.toLowerCase().includes(needle) ||
            (item.hint ?? "").toLowerCase().includes(needle)
          );
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, needle]);

  const handleSelect = (item: MobileMoreNavItem) => {
    triggerHaptic("light");
    onNavigate(item.id);
    onClose();
    setQuery("");
  };

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      ariaLabel="More navigation"
      desktopMaxWidth="max-w-lg"
      wrapChildrenInScroll={false}
      showClose={false}
      panelClassName="mobile-more-sheet"
      zIndex={280}
    >
      <div className="flex flex-col min-h-0 flex-1 h-full">
        <div className="shrink-0 px-5 pb-3 border-b border-border-glass">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandLogo size="sm" />
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-text-primary leading-none">
                  More
                </h2>
                <p className="mt-1 text-[11px] text-text-muted truncate">
                  {workspace.name}
                </p>
              </div>
            </div>
          </div>

          <label className="relative block">
            <span className="sr-only">Go to</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Go to…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              className="w-full min-h-[44px] rounded-xl border border-border-glass bg-surface-hover pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-neon-purple/40 focus:ring-2 focus:ring-neon-purple/20"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-5">
          {filteredGroups.map((group) => (
            <section key={group.id} aria-labelledby={`more-nav-${group.id}`}>
              <h3
                id={`more-nav-${group.id}`}
                className="px-1 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted"
              >
                {group.label}
              </h3>
              <div className="rounded-2xl border border-border-glass bg-bg-panel overflow-hidden divide-y divide-border-glass">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const label = item.shortLabel ?? item.label;
                  const active = currentView === item.id;
                  const showChatBadge = item.id === "chat" && chatUnread && !active;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 min-h-[52px] text-left touch-manipulation select-none active:bg-surface-hover transition-colors",
                        active
                          ? "bg-neon-purple/10 text-neon-purple"
                          : "text-text-primary",
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 h-9 w-9 rounded-xl border flex items-center justify-center",
                          active
                            ? "border-neon-purple/35 bg-neon-purple/15"
                            : "border-border-glass bg-surface-hover",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{label}</span>
                        {item.hint ? (
                          <span className="block text-[11px] text-text-muted truncate mt-0.5">
                            {item.hint}
                          </span>
                        ) : null}
                      </span>
                      {showChatBadge ? (
                        <span
                          className="h-2 w-2 rounded-full bg-[var(--priority-p0)] shrink-0"
                          aria-label="Unread messages"
                        />
                      ) : null}
                      <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {filteredGroups.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-10">
              No matching pages
            </p>
          ) : null}
        </div>
      </div>
    </BottomSheet>
  );
}
