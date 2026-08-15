"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { triggerHaptic } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useMobileSheetDrag } from "@/lib/hooks/useMobileSheetDrag";
import { useVisualViewportInsets } from "@/lib/hooks/useVisualViewportInsets";
import { MOBILE_SHEET_HEIGHT_CLASS } from "@/lib/motion/sheet";
import { isSheetBlankDragTarget } from "@/lib/motion/sheetDragTarget";
import type { WorkspaceChatController } from "../hooks/useWorkspaceChat";
import { WorkspaceChatPanel, type WorkspaceChatPanelProps } from "./WorkspaceChatPanel";
import { SheetDragHandle } from "@/components/SheetDragHandle";

export interface ChatDrawerProps extends WorkspaceChatPanelProps {
  open: boolean;
  onClose: () => void;
  chat?: WorkspaceChatController;
}

export function ChatDrawer({ open, onClose, chat, ...panelProps }: ChatDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const finishClose = useCallback(() => {
    triggerHaptic("light");
    onClose();
  }, [onClose]);

  const {
    sheetY,
    backdropOpacityMotion,
    requestDismiss,
    animateEnter,
    setDismissTarget,
    resetDrag,
    startDrag,
    attachCaptureDragSurface,
  } = useMobileSheetDrag({
    enabled: open,
    onDismiss: finishClose,
    dragMode: "handle",
    dragEngine: "manual",
  });

  useScrollLock(open);
  useVisualViewportInsets(open);

  const handleClose = useCallback(() => {
    requestDismiss();
  }, [requestDismiss]);

  useLayoutEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    const height = panelRef.current?.offsetHeight ?? window.innerHeight;
    setDismissTarget(height);
    if (!openedRef.current) {
      openedRef.current = true;
      animateEnter();
    }
  }, [open, animateEnter, setDismissTarget]);

  useLayoutEffect(() => {
    if (!open) return;
    return attachCaptureDragSurface(panelRef.current, {
      getScrollEl: () => panelRef.current?.querySelector<HTMLElement>(".chat-message-list") ?? null,
      scrollGateSelector: ".chat-message-list",
      canStart: isSheetBlankDragTarget,
    });
  }, [attachCaptureDragSurface, open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence onExitComplete={resetDrag}>
      {open && (
        <div className="fixed inset-0 z-[200] xl:hidden flex flex-col">
          <motion.div
            className="absolute inset-0 overlay-scrim backdrop-blur-sm sheet-backdrop"
            initial={false}
            style={{ opacity: backdropOpacityMotion }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Messages"
            className={`chat-drawer-sheet relative flex flex-col bg-bg border-t border-border-glass rounded-t-3xl overflow-hidden mobile-bottom-sheet keyboard-stable-sheet ${MOBILE_SHEET_HEIGHT_CLASS}`}
            initial={{ opacity: 0.98 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ y: sheetY }}
          >
            <SheetDragHandle onPointerDown={startDrag} />
            <div
              ref={headerRef}
              className="chat-drawer-header flex items-center justify-between px-4 py-2 border-b border-border-glass shrink-0"
            >
              <div className="font-semibold">Messages</div>
              <button
                type="button"
                onClick={handleClose}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-primary active:scale-95 transition"
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
