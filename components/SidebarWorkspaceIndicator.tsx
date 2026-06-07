"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatRoleLabel } from "@/lib/roles";
import type { Workspace } from "@/types";
import {
  AnimatedWorkspaceName,
  WorkspaceSwitchEffects,
  workspaceNameEase,
} from "@/components/WorkspaceSwitchEffects";

interface SidebarWorkspaceIndicatorProps {
  workspace: Workspace;
  showRole?: boolean;
  canManage?: boolean;
}

export function SidebarWorkspaceIndicator({
  workspace,
  showRole = true,
  canManage = false,
}: SidebarWorkspaceIndicatorProps) {
  return (
    <div className="px-3 mb-4 min-w-0">
      <div className="text-xs text-[#71717a] font-medium tracking-widest mb-1.5 px-1">
        WORKSPACE
      </div>

      <div className="relative rounded-xl overflow-hidden border border-transparent">
        <WorkspaceSwitchEffects workspaceId={workspace.id} variant="sidebar" />

        <div className="relative py-2 pl-3.5 pr-1 min-h-[2.75rem]">
          <AnimatedWorkspaceName
            workspaceId={workspace.id}
            name={workspace.name}
            className="block text-lg font-semibold tracking-tighter leading-snug break-words text-[#f4f4f5]"
          />
        </div>
      </div>

      {showRole && workspace.role && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${workspace.id}-${workspace.role}`}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.28, ease: workspaceNameEase, delay: 0.06 }}
            className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-[#c084fc] font-mono tracking-widest border border-white/10"
            title={
              canManage
                ? "You can manage members and invites (owner/admin). Workspace name and URL are owner-only."
                : "Member access. Team management requires owner or admin."
            }
          >
            {formatRoleLabel(workspace.role)}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  );
}