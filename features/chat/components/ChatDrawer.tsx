"use client";

import React from "react";
import { X } from "lucide-react";
import type { WorkspaceChatController } from "../hooks/useWorkspaceChat";
import { WorkspaceChatPanel, type WorkspaceChatPanelProps } from "./WorkspaceChatPanel";

export interface ChatDrawerProps extends WorkspaceChatPanelProps {
  open: boolean;
  onClose: () => void;
  chat?: WorkspaceChatController;
}

export function ChatDrawer({ open, onClose, chat, ...panelProps }: ChatDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] xl:hidden flex flex-col">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex flex-col h-full bg-[#0a0a0f] border-t border-white/10 mt-12 rounded-t-3xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="font-semibold">Team chat</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-[#71717a] hover:text-white"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 px-4 pb-0">
          <WorkspaceChatPanel {...panelProps} chat={chat} isOpen showHeader={false} className="h-full" />
        </div>
      </div>
    </div>
  );
}