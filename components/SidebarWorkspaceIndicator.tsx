"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatRoleLabel } from "@/lib/roles";
import type { Workspace } from "@/types";

interface SidebarWorkspaceIndicatorProps {
  workspace: Workspace;
  showRole?: boolean;
  canManage?: boolean;
}

const nameEase = [0.22, 1, 0.36, 1] as const;

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
        <AnimatePresence>
          <motion.div
            key={`ws-burst-${workspace.id}`}
            initial={{ opacity: 0.5, scale: 0.94 }}
            animate={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="absolute inset-0 rounded-xl bg-[#c084fc]/20 pointer-events-none"
            aria-hidden
          />
          <motion.div
            key={`ws-shimmer-${workspace.id}`}
            initial={{ x: "-120%", opacity: 0.7 }}
            animate={{ x: "220%", opacity: 0 }}
            transition={{ duration: 0.75, ease: "easeOut", delay: 0.04 }}
            className="absolute inset-y-0 w-1/2 pointer-events-none bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
            aria-hidden
          />
        </AnimatePresence>

        <div className="relative py-2 pl-3.5 pr-1 min-h-[2.75rem]">
          <motion.div
            key={`ws-accent-${workspace.id}`}
            initial={{ scaleY: 0.2, opacity: 0.4 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] origin-center rounded-full bg-gradient-to-b from-[#e9d5ff] via-[#c084fc] to-[#a855f7]"
            style={{ boxShadow: "0 0 16px rgba(192, 132, 252, 0.55)" }}
            aria-hidden
          />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={workspace.id}
              initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={{ duration: 0.34, ease: nameEase }}
              className="text-lg font-semibold tracking-tighter leading-snug break-words text-[#f4f4f5]"
            >
              {workspace.name}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {showRole && workspace.role && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${workspace.id}-${workspace.role}`}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.28, ease: nameEase, delay: 0.06 }}
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