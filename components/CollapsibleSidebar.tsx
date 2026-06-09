"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  FolderOpen,
  Home,
  ListChecks,
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
  readSidebarPinMode,
  writeSidebarPinMode,
  type SidebarPinMode,
} from "@/lib/sidebarPreferences";
import type { Workspace } from "@/types";

type AppViewId = "home" | "tasks" | "notes" | "lists" | "teams" | "settings" | "admin";

const WORKSPACE_VIEWS: Array<{ id: AppViewId; label: string; Icon: LucideIcon }> = [
  { id: "tasks", label: "Tasks", Icon: Check },
  { id: "notes", label: "Files", Icon: FolderOpen },
  { id: "lists", label: "Lists", Icon: ListChecks },
  { id: "teams", label: "Team", Icon: Users },
  { id: "settings", label: "Workspace Settings", Icon: Settings },
];

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
        className="sidebar-tooltip pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#18181b] px-2.5 py-1.5 text-xs font-medium text-[#f4f4f5] opacity-0 shadow-lg transition-opacity duration-150 group-hover/item:opacity-100"
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
  showRole: boolean;
  canManage: boolean;
  openTaskCount: number;
  overdueTaskCount: number;
  reviewCount: number;
  isSiteAdmin: boolean;
}

export function CollapsibleSidebar({
  currentView,
  onNavigate,
  workspace,
  showRole,
  canManage,
  openTaskCount,
  overdueTaskCount,
  reviewCount,
  isSiteAdmin,
}: CollapsibleSidebarProps) {
  const [pinMode, setPinMode] = useState<SidebarPinMode>("pinned");
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPinMode(readSidebarPinMode());
    setHydrated(true);
  }, []);

  const isCollapsed = pinMode === "auto" && !hoverExpanded;
  const showTooltips = isCollapsed;

  const togglePinMode = useCallback(() => {
    setPinMode((prev) => {
      const next: SidebarPinMode = prev === "pinned" ? "auto" : "pinned";
      writeSidebarPinMode(next);
      if (next === "pinned") setHoverExpanded(false);
      return next;
    });
  }, []);

  const navItemClass = (active: boolean, compact?: boolean) =>
    cn(
      "sidebar-item w-full",
      compact && "sidebar-item--compact justify-center px-0",
      active && "active",
    );

  return (
    <aside
      className={cn(
        "sidebar hidden lg:flex flex-col shrink-0 overflow-hidden border-r border-white/10 transition-[width] duration-300 ease-in-out",
        isCollapsed ? "sidebar--collapsed w-[4.25rem]" : "w-64",
        !hydrated && "w-64",
      )}
      aria-label="Workspace navigation and views"
      onMouseEnter={() => {
        if (pinMode === "auto") setHoverExpanded(true);
      }}
      onMouseLeave={() => {
        if (pinMode === "auto") setHoverExpanded(false);
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
          <SidebarWorkspaceIndicator
            workspace={workspace}
            showRole={showRole}
            canManage={canManage}
          />
        ) : (
          <div
            className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-[#c084fc]"
            title={workspace.name}
            aria-label={`Workspace: ${workspace.name}`}
          >
            {(workspace.name || "W").charAt(0).toUpperCase()}
          </div>
        )}

        <div className={cn("space-y-0.5 px-1 flex-1 min-h-0", isCollapsed && "px-0")}>
          {WORKSPACE_VIEWS.map((v) => {
            const Icon = v.Icon;
            const isActive = currentView === v.id;
            const label =
              v.id === "settings" ? "Settings" : v.label;

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
          <div className={cn("px-1 mt-4 pt-4 border-t border-white/10", isCollapsed && "px-0")}>
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
                  currentView === "admin" && "active border-[#c084fc]/30 bg-[#c084fc]/10",
                )}
              >
                <Shield className="h-4 w-4 text-[#c084fc]" />
                {!isCollapsed && <span>Admin</span>}
              </div>
            </SidebarTooltip>
          </div>
        )}

        <div className={cn("mt-auto space-y-2 px-1 pb-4", isCollapsed && "px-0")}>
          {!isCollapsed && (
            <div className="px-3 text-[10px] text-[#71717a]">
              <div className="mb-1">Badazz Tasks</div>
              <div>Real-time sync active.</div>
            </div>
          )}

          <SidebarTooltip
            label={pinMode === "pinned" ? "Collapse automatically" : "Keep expanded"}
            show={showTooltips}
          >
            <button
              type="button"
              onClick={togglePinMode}
              className={cn(
                "sidebar-item w-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                isCollapsed && "sidebar-item--compact justify-center px-0",
              )}
              aria-pressed={pinMode === "pinned"}
              aria-label={
                pinMode === "pinned"
                  ? "Switch to automatic collapse"
                  : "Keep sidebar expanded"
              }
            >
              {pinMode === "pinned" ? (
                <PanelLeftClose className="h-4 w-4 shrink-0 text-[#a1a1aa]" />
              ) : (
                <PanelLeftOpen className="h-4 w-4 shrink-0 text-[#c084fc]" />
              )}
              {!isCollapsed && (
                <span className="text-xs text-[#a1a1aa]">
                  {pinMode === "pinned" ? "Collapse automatically" : "Keep expanded"}
                </span>
              )}
            </button>
          </SidebarTooltip>
        </div>
      </div>
    </aside>
  );
}