"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  FolderOpen,
  HeartPulse,
  Home,
  ListChecks,
  Notebook,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarWorkspaceIndicator } from "@/components/SidebarWorkspaceIndicator";
import { TasksNavIndicator } from "@/components/TasksNavIndicator";
import { FilesNavIndicator } from "@/components/FilesNavIndicator";
import {
  readSidebarDisplayMode,
  writeSidebarDisplayMode,
  SIDEBAR_DISPLAY_OPTIONS,
  type SidebarDisplayMode,
} from "@/lib/sidebarPreferences";
import type { Workspace } from "@/types";
import { getSidebarWorkspaceViews, type WorkspaceNavViewId } from "@/lib/nav/workspaceViews";

type AppViewId = WorkspaceNavViewId;

const VIEW_ICONS: Record<AppViewId, LucideIcon> = {
  home: Home,
  tasks: Check,
  notes: FolderOpen,
  notebooks: Notebook,
  lists: ListChecks,
  health: HeartPulse,
  teams: Users,
  settings: Settings,
  admin: Shield,
};

function modeIcon(mode: SidebarDisplayMode) {
  switch (mode) {
    case "expanded":
      return PanelLeft;
    case "hover-expand":
      return PanelLeftOpen;
    case "icons-only":
      return PanelLeftClose;
  }
}

function SidebarTooltip({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return <>{children}</>;
  return (
    <div className="sidebar-tooltip-wrap group/item relative flex w-full">
      {children}
      <span
        role="tooltip"
        className="sidebar-tooltip pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border-glass bg-bg-tertiary px-2.5 py-1.5 text-xs font-medium text-text-primary opacity-0 shadow-lg transition-opacity duration-150 group-hover/item:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}

interface CollapsibleSidebarProps {
  currentView: AppViewId;
  onNavigate: (view: AppViewId) => void;
  workspace: Workspace;
  openTaskCount: number;
  overdueTaskCount: number;
  reviewCount: number;
  isSiteAdmin: boolean;
}

export function CollapsibleSidebar({
  currentView,
  onNavigate,
  workspace,
  openTaskCount,
  overdueTaskCount,
  reviewCount,
  isSiteAdmin,
}: CollapsibleSidebarProps) {
  const [displayMode, setDisplayMode] = useState<SidebarDisplayMode>("expanded");
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayMode(readSidebarDisplayMode());
    setHydrated(true);
  }, []);

  const updateMenuAnchor = useCallback(() => {
    if (!menuRef.current) return;
    setMenuAnchor(menuRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      const portal = document.getElementById("sidebar-layout-menu-portal");
      if (portal?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const isCollapsed =
    displayMode === "icons-only" ||
    (displayMode === "hover-expand" && !hoverExpanded);
  const showTooltips = isCollapsed;

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuAnchor(null);
      return;
    }
    updateMenuAnchor();
    window.addEventListener("resize", updateMenuAnchor);
    window.addEventListener("scroll", updateMenuAnchor, true);
    return () => {
      window.removeEventListener("resize", updateMenuAnchor);
      window.removeEventListener("scroll", updateMenuAnchor, true);
    };
  }, [menuOpen, isCollapsed, updateMenuAnchor]);

  const selectMode = useCallback((mode: SidebarDisplayMode) => {
    setDisplayMode(mode);
    writeSidebarDisplayMode(mode);
    setHoverExpanded(false);
    setMenuOpen(false);
  }, []);

  const navItemClass = (active: boolean, compact?: boolean) =>
    cn(
      "sidebar-item w-full",
      compact && "sidebar-item--compact justify-center px-0",
      active && "active",
    );

  const activeOption =
    SIDEBAR_DISPLAY_OPTIONS.find((o) => o.mode === displayMode) ??
    SIDEBAR_DISPLAY_OPTIONS[0];
  const ModeIcon = modeIcon(displayMode);

  return (
    <aside
      className={cn(
        "sidebar hidden lg:flex flex-col shrink-0 border-r border-border-glass transition-[width] duration-300 ease-in-out",
        menuOpen ? "overflow-visible" : "overflow-hidden",
        isCollapsed ? "sidebar--collapsed w-[4.25rem]" : "w-64",
        !hydrated && "w-64",
      )}
      aria-label="Workspace navigation and views"
      onMouseEnter={() => {
        if (displayMode === "hover-expand") setHoverExpanded(true);
      }}
      onMouseLeave={() => {
        if (displayMode === "hover-expand") setHoverExpanded(false);
      }}
    >
      <div className="flex flex-col flex-1 min-h-0 pt-3 px-2">
        <div className={cn("px-1 mb-2", isCollapsed && "px-0")}>
          <SidebarTooltip label="Home" show={showTooltips}>
            <div
              role="button"
              tabIndex={0}
              aria-current={currentView === "home" ? "page" : undefined}
              aria-label="Home"
              onClick={() => onNavigate("home")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onNavigate("home");
                }
              }}
              className={cn(
                "sidebar-item sidebar-item--home",
                isCollapsed && "sidebar-item--compact justify-center px-0",
                currentView === "home" && "active",
              )}
            >
              <span className="sidebar-item--home__icon" aria-hidden="true">
                <Home className="h-4 w-4" />
              </span>
              {!isCollapsed && <span className="truncate">Home</span>}
            </div>
          </SidebarTooltip>
        </div>

        {!isCollapsed ? (
          <SidebarWorkspaceIndicator workspace={workspace} />
        ) : (
          <div
            className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-border-glass bg-surface-hover text-xs font-bold text-neon-purple"
            title={workspace.name}
            aria-label={`Workspace: ${workspace.name}`}
          >
            {(workspace.name || "W").charAt(0).toUpperCase()}
          </div>
        )}

        <div className={cn("space-y-0.5 px-1 flex-1 min-h-0", isCollapsed && "px-0")}>
          {getSidebarWorkspaceViews(workspace).map((v) => {
            const Icon = VIEW_ICONS[v.id];
            const isActive = currentView === v.id;
            const label = v.shortLabel ?? v.label;

            return (
              <SidebarTooltip key={v.id} label={label} show={showTooltips}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={label}
                  onClick={() => onNavigate(v.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onNavigate(v.id);
                    }
                  }}
                  className={navItemClass(isActive, isCollapsed)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 min-w-0 truncate">{label}</span>
                      {v.id === "tasks" && (
                        <TasksNavIndicator
                          openCount={openTaskCount}
                          overdueCount={overdueTaskCount}
                          variant="sidebar"
                        />
                      )}
                      {v.id === "notes" && (
                        <FilesNavIndicator reviewCount={reviewCount} variant="sidebar" />
                      )}
                    </>
                  )}
                  {isCollapsed && v.id === "tasks" && openTaskCount > 0 && (
                    <span className="sidebar-item__dot sidebar-item__dot--tasks" aria-hidden />
                  )}
                  {isCollapsed && v.id === "notes" && reviewCount > 0 && (
                    <span className="sidebar-item__dot sidebar-item__dot--review" aria-hidden />
                  )}
                </div>
              </SidebarTooltip>
            );
          })}
        </div>

        {isSiteAdmin && (
          <div className={cn("px-1 mt-4 pt-4 border-t border-border-glass", isCollapsed && "px-0")}>
            <SidebarTooltip label="Admin" show={showTooltips}>
              <div
                role="button"
                tabIndex={0}
                aria-current={currentView === "admin" ? "page" : undefined}
                aria-label="Admin"
                onClick={() => onNavigate("admin")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onNavigate("admin");
                  }
                }}
                className={cn(
                  "sidebar-item border border-transparent",
                  isCollapsed && "sidebar-item--compact justify-center px-0",
                  currentView === "admin" && "active border-neon-purple/30 bg-neon-purple/10",
                )}
              >
                <Shield className="h-4 w-4 text-neon-purple" />
                {!isCollapsed && <span>Admin</span>}
              </div>
            </SidebarTooltip>
          </div>
        )}

        <div className={cn("mt-auto space-y-2 px-1 pb-4", isCollapsed && "px-0")}>
          {!isCollapsed && (
            <div className="px-3 text-[10px] text-text-muted">
              <div className="mb-1">Badazz Tasks</div>
              <div>Real-time sync active.</div>
            </div>
          )}

          <div ref={menuRef} className="relative">
            <SidebarTooltip label="Sidebar layout" show={showTooltips}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className={cn(
                  "sidebar-item w-full border border-border-glass bg-surface-overlay hover:bg-surface-overlay-hover",
                  isCollapsed && "sidebar-item--compact justify-center px-0",
                  menuOpen && "bg-surface-overlay-hover border-neon-purple/30",
                )}
                aria-expanded={menuOpen}
                aria-haspopup="listbox"
                aria-label={`Sidebar layout: ${activeOption.label}`}
              >
                <ModeIcon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    displayMode === "expanded" ? "text-text-secondary" : "text-neon-purple",
                  )}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left text-xs text-text-secondary truncate">
                      {activeOption.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-text-muted transition",
                        menuOpen && "rotate-180",
                      )}
                    />
                  </>
                )}
              </button>
            </SidebarTooltip>

            {menuOpen &&
              menuAnchor &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  id="sidebar-layout-menu-portal"
                  className="fixed z-[300] rounded-xl border border-border-glass bg-bg-card py-1 shadow-xl w-56"
                  style={
                    isCollapsed
                      ? {
                          left: menuAnchor.right + 8,
                          bottom: window.innerHeight - menuAnchor.bottom,
                        }
                      : {
                          left: menuAnchor.left,
                          bottom: window.innerHeight - menuAnchor.top + 4,
                          width: menuAnchor.width,
                        }
                  }
                  role="listbox"
                  aria-label="Sidebar layout options"
                >
                  {SIDEBAR_DISPLAY_OPTIONS.map((option) => {
                    const OptionIcon = modeIcon(option.mode);
                    const selected = displayMode === option.mode;
                    return (
                      <button
                        key={option.mode}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => selectMode(option.mode)}
                        className={cn(
                          "w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-surface-hover",
                          selected && "bg-neon-purple/10",
                        )}
                      >
                        <OptionIcon
                          className={cn(
                            "h-4 w-4 shrink-0 mt-0.5",
                            selected ? "text-neon-purple" : "text-text-muted",
                          )}
                        />
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "block text-xs font-medium",
                              selected ? "text-neon-purple-tint" : "text-text-primary",
                            )}
                          >
                            {option.label}
                          </span>
                          <span className="block text-[10px] text-text-muted mt-0.5 leading-snug">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>,
                document.body,
              )}
          </div>
        </div>
      </div>
    </aside>
  );
}