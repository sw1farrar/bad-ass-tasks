"use client";

import React from "react";
import { Check, Home, Star, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MainLayout
 *
 * M0 Batch 2.18 start — layout shell extraction.
 *
 * Goal: Pull the giant top bar + sidebar + main content switch out of app/page.tsx.
 *
 * Current status: Thin shell. Navigation and view switching logic remain in parent for safety.
 */

export interface MainLayoutProps {
  currentView: string;
  onViewChange: (view: string) => void;
  children: React.ReactNode;

  // Workspace switcher (still controlled from parent)
  currentWorkspace: any;
  workspaces: any[];
  onSwitchWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  showWorkspaceMenu: boolean;
  setShowWorkspaceMenu: (open: boolean) => void;

  // Other top-level UI
  user: any;
  onSignOut: () => void;
  onOpenInstallPrompt?: () => void;
  deferredPrompt: any;

  /** Content to render in the right side of the top bar (workspace switcher, notifs, profile, quick add, etc.) */
  headerRight?: React.ReactNode;
}

export function MainLayout(props: MainLayoutProps) {
  const {
    currentView,
    onViewChange,
    children,
    currentWorkspace,
    workspaces,
    onSwitchWorkspace,
    onCreateWorkspace,
    showWorkspaceMenu,
    setShowWorkspaceMenu,
    user,
    onSignOut,
    onOpenInstallPrompt,
    deferredPrompt,
    headerRight,
  } = props;

  const VIEWS = [
    { id: "home", label: "Home", icon: Home },
    { id: "today", label: "Today", icon: Check },
    { id: "tasks", label: "Tasks", icon: Check },
    { id: "notes", label: "Notes", icon: Star },
    { id: "teams", label: "Team", icon: Users },
  ] as const;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0f] text-[#f4f4f5]">
      {/* Top Bar — basic logo moved into layout (incremental step) */}
      <div className="top-bar relative h-16 border-b border-white/10 flex items-center px-5 justify-between z-50 bg-[#0a0a0f]/95 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 md:h-4.5 md:w-4.5 text-black" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="font-semibold tracking-[-0.3px] text-sm md:text-[17px] leading-none whitespace-nowrap">Bad Ass Tasks</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {headerRight}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar navigation (first real piece moved into layout) */}
        <div className="w-56 border-r border-white/10 bg-[#0a0a0f] p-3 hidden md:block overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-[#71717a] px-2 mb-2">Views</div>
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const isActive = currentView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => onViewChange(v.id)}
                className={cn(
                  "sidebar-item w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm mb-0.5 transition-colors",
                  isActive && "active bg-white/5"
                )}
              >
                <Icon className="h-4 w-4" />
                {v.label}
              </button>
            );
          })}
        </div>

        {/* Main content passed from parent */}
        <div className="main-content flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
