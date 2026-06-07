"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { triggerHaptic } from "@/lib/utils";
import type { WorkspaceChatController } from "../hooks/useWorkspaceChat";
import { WorkspaceChatPanel, type WorkspaceChatPanelProps } from "./WorkspaceChatPanel";

export interface ChatDrawerProps extends WorkspaceChatPanelProps {
  open: boolean;
  onClose: () => void;
  chat?: WorkspaceChatController;
}

export function ChatDrawer({ open, onClose, chat, ...panelProps }: ChatDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleClose = () => {
    triggerHaptic("light");
    onClose();
  };

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      handleClose();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] xl:hidden flex flex-col">
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            aria-hidden
          />
          <motion.div
            className="relative flex flex-col h-[100dvh] bg-[#0a0a0f] border-t border-white/10 rounded-t-3xl overflow-hidden mobile-bottom-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320, mass: 0.85 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 500 }}
            dragElastic={0.12}
            onDragEnd={handleDragEnd}
          >
            <div className="sheet-drag-handle shrink-0" aria-hidden="true" />
            <div
              className="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0"
              style={{ paddingTop: "max(0.25rem, env(safe-area-inset-top, 0px))" }}
            >
              <div className="font-semibold">Messages</div>
              <button
                type="button"
                onClick={handleClose}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 text-[#71717a] hover:text-white active:scale-95 transition"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 px-4 pb-0">
              <WorkspaceChatPanel
                {...panelProps}
                chat={chat}
                isOpen
                showHeader={false}
                className="h-full"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}