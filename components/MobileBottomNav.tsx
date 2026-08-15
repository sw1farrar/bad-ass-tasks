"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { cn, triggerHaptic } from "@/lib/utils";
import {
  getMobilePrimaryNavViews,
  isMobilePrimaryNavView,
  type WorkspaceNavViewId,
} from "@/lib/nav/workspaceViews";
import { FilesNavIndicator } from "@/components/FilesNavIndicator";
import { TasksNavIndicator } from "@/components/TasksNavIndicator";
import {
  AnimatedBottomNavItemContent,
  WorkspaceSwitchEffects,
} from "@/components/WorkspaceSwitchEffects";
import { MobileMoreSheet } from "@/components/MobileMoreSheet";
import type { Workspace } from "@/types";

const NAV_DEBOUNCE_MS = 400;

type MobileBottomNavProps = {
  currentView: WorkspaceNavViewId | string;
  onNavigate: (view: WorkspaceNavViewId) => void;
  workspace: Workspace;
  showChat?: boolean;
  isSiteAdmin?: boolean;
  openTaskCount: number;
  overdueTaskCount: number;
  reviewCount: number;
  chatUnread?: boolean;
};

function scrollMainToTop() {
  const main = document.querySelector<HTMLElement>("main.main-content");
  main?.scrollTo({ top: 0, behavior: "smooth" });
}

export function MobileBottomNav({
  currentView,
  onNavigate,
  workspace,
  showChat = false,
  isSiteAdmin = false,
  openTaskCount,
  overdueTaskCount,
  reviewCount,
  chatUnread = false,
}: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const lastNavAtRef = useRef(0);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const primaryViews = useMemo(
    () => getMobilePrimaryNavViews(workspace, { showChat }),
    [workspace, showChat],
  );

  const overflowActive = !isMobilePrimaryNavView(currentView);
  const moreActive = moreOpen || overflowActive;
  const moreHasBadge = Boolean(chatUnread) && currentView !== "chat";

  const navigateTo = useCallback(
    (view: WorkspaceNavViewId) => {
      const now = Date.now();
      if (view === currentView) {
        scrollMainToTop();
        setMoreOpen(false);
        return;
      }
      if (now - lastNavAtRef.current < NAV_DEBOUNCE_MS) return;
      lastNavAtRef.current = now;
      triggerHaptic("light");
      onNavigate(view);
      setMoreOpen(false);
    },
    [currentView, onNavigate],
  );

  return (
    <>
      <nav
        className="bottom-nav md:hidden border-t border-border-glass"
        aria-label="Primary navigation"
        data-mobile-bottom-nav
        style={{ touchAction: "manipulation" }}
      >
        <WorkspaceSwitchEffects workspaceId={workspace.id} variant="bottom-nav" />

        {primaryViews.map((view, navIndex) => {
          const Icon = view.icon;
          const isActive = currentView === view.id && !moreOpen;
          const label = view.shortLabel ?? view.label;
          const ariaLabel =
            view.id === "tasks" && openTaskCount > 0
              ? overdueTaskCount > 0
                ? `${label}, ${openTaskCount} open, ${overdueTaskCount} overdue`
                : `${label}, ${openTaskCount} open`
              : view.id === "notes" && reviewCount > 0
                ? `${label}, ${reviewCount} in Review`
                : label;
          return (
            <button
              key={view.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              aria-label={ariaLabel}
              data-pressed={pressedId === view.id || undefined}
              onPointerDown={() => setPressedId(view.id)}
              onPointerUp={() => setPressedId(null)}
              onPointerCancel={() => setPressedId(null)}
              onPointerLeave={() => setPressedId(null)}
              onClick={() => navigateTo(view.id)}
              className={cn(
                "bottom-nav-item relative z-[1]",
                view.id === "home" && "bottom-nav-item--home",
                view.id === "lists" && "bottom-nav-item--lists",
                isActive && "active",
              )}
            >
              <AnimatedBottomNavItemContent
                workspaceId={workspace.id}
                itemId={view.id}
                index={navIndex}
              >
                <span className="bottom-nav-item__icon-wrap">
                  <Icon className="icon" strokeWidth={isActive ? 2.25 : 2} />
                  {view.id === "tasks" && (
                    <span aria-hidden>
                      <TasksNavIndicator
                        openCount={openTaskCount}
                        overdueCount={overdueTaskCount}
                        variant="bottom"
                      />
                    </span>
                  )}
                  {view.id === "notes" && (
                    <span aria-hidden>
                      <FilesNavIndicator reviewCount={reviewCount} variant="bottom" />
                    </span>
                  )}
                </span>
                <span className="bottom-nav-item__label font-medium tracking-tight">
                  {label}
                </span>
              </AnimatedBottomNavItemContent>
            </button>
          );
        })}

        <button
          ref={moreButtonRef}
          type="button"
          aria-label="More"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={moreActive && !moreOpen ? "page" : undefined}
          data-pressed={pressedId === "more" || undefined}
          onPointerDown={() => setPressedId("more")}
          onPointerUp={() => setPressedId(null)}
          onPointerCancel={() => setPressedId(null)}
          onPointerLeave={() => setPressedId(null)}
          onClick={() => {
            triggerHaptic("light");
            setMoreOpen((open) => !open);
          }}
          className={cn(
            "bottom-nav-item bottom-nav-item--more relative z-[1]",
            moreActive && "active",
          )}
        >
          <AnimatedBottomNavItemContent
            workspaceId={workspace.id}
            itemId="more"
            index={primaryViews.length}
          >
            <span className="bottom-nav-item__icon-wrap">
              <Menu className="icon" strokeWidth={moreActive ? 2.25 : 2} />
              {moreHasBadge && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--priority-p0)] ring-2 ring-bg"
                  aria-hidden
                />
              )}
            </span>
            <span className="bottom-nav-item__label font-medium tracking-tight">More</span>
          </AnimatedBottomNavItemContent>
        </button>
      </nav>

      <MobileMoreSheet
        open={moreOpen}
        onClose={() => {
          setMoreOpen(false);
          window.requestAnimationFrame(() => moreButtonRef.current?.focus());
        }}
        currentView={currentView}
        onNavigate={navigateTo}
        workspace={workspace}
        showChat={showChat}
        isSiteAdmin={isSiteAdmin}
        chatUnread={chatUnread}
      />
    </>
  );
}
