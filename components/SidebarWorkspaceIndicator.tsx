"use client";

import React from "react";
import type { Workspace } from "@/types";
import {
  AnimatedWorkspaceName,
  WorkspaceSwitchEffects,
} from "@/components/WorkspaceSwitchEffects";

interface SidebarWorkspaceIndicatorProps {
  workspace: Workspace;
}

export function SidebarWorkspaceIndicator({
  workspace,
}: SidebarWorkspaceIndicatorProps) {
  return (
    <div className="sidebar-workspace-indicator px-3 mb-4 min-w-0">
      <div className="text-xs text-text-muted font-medium tracking-widest mb-1.5 px-1">
        WORKSPACE
      </div>

      <div className="relative rounded-xl border border-transparent">
        <WorkspaceSwitchEffects workspaceId={workspace.id} variant="sidebar" />

        <div className="relative py-2.5 pl-3.5 pr-2 min-w-0">
          <AnimatedWorkspaceName
            workspaceId={workspace.id}
            name={workspace.name}
            className="block text-2xl font-semibold leading-snug tracking-tight text-text-primary"
          />
        </div>
      </div>
    </div>
  );
}