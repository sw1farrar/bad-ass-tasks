'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/lib/hooks/useScrollLock';
import { useIsMobileViewport } from '@/lib/hooks/useIsMobileViewport';
import { BottomSheet } from '@/components/BottomSheet';

/** Above receipt ledger drawer (920) and policy tooltips (960); below file preview (10050). */
const CONFIRMATION_MODAL_Z_INDEX = 1000;

interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Emphasized item name shown inside the description area */
  highlight?: string;
  /** Optional extra content below the description (e.g. item lists) */
  details?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

function ConfirmationBody({
  title,
  description,
  highlight,
  details,
  confirmText,
  cancelText,
  variant,
  isLoading,
  close,
  handleConfirm,
  showHeaderClose = true,
  hideTitle = false,
}: {
  title: string;
  description?: string;
  highlight?: string;
  details?: React.ReactNode;
  confirmText: string;
  cancelText: string;
  variant: 'default' | 'destructive';
  isLoading: boolean;
  close: () => void;
  handleConfirm: () => void;
  showHeaderClose?: boolean;
  hideTitle?: boolean;
}) {
  return (
    <>
      <div className="flex items-start gap-3 p-5 pb-4">
        {variant === 'destructive' && (
          <div className="confirmation-modal__icon mt-0.5 rounded-xl bg-[var(--priority-p0)]/10 p-2 shrink-0">
            <AlertTriangle className="h-5 w-5 text-[var(--priority-p0)]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {!hideTitle && (
            <h3
              id="confirm-dialog-title"
              className="text-base sm:text-lg font-semibold text-text-primary tracking-tight"
            >
              {title}
            </h3>
          )}
          {(description || highlight) && (
            <div id="confirm-dialog-desc" className="mt-2 space-y-1.5">
              {highlight && (
                <p className="text-sm font-medium text-text-primary truncate">
                  &ldquo;{highlight}&rdquo;
                </p>
              )}
              {description && (
                <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
              )}
              {details}
            </div>
          )}
        </div>
        {showHeaderClose && (
          <button
            type="button"
            onClick={close}
            disabled={isLoading}
            className="text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-surface-hover transition shrink-0 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex flex-col-reverse md:flex-row gap-2.5 px-5 pb-5">
        <button
          type="button"
          onClick={close}
          disabled={isLoading}
          className="confirmation-modal__cancel flex-1 min-h-[44px] rounded-xl border border-border-glass px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 transition"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isLoading}
          className={cn(
            'confirmation-modal__confirm flex-1 min-h-[44px] rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition',
            variant === 'destructive'
              ? 'confirmation-modal__confirm--destructive border-transparent bg-[var(--priority-p0)] hover:bg-[var(--priority-p0)]/90 text-accent-on'
              : 'confirmation-modal__confirm--default border-transparent bg-neon-purple hover:bg-neon-purple-dark text-accent-on'
          )}
        >
          {isLoading ? 'Processing…' : confirmText}
        </button>
      </div>
    </>
  );
}

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  highlight,
  details,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  isLoading = false,
}: ConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    if (!isLoading) onOpenChange(false);
  }, [isLoading, onOpenChange]);

  useScrollLock(open && !isMobile);

  useEffect(() => {
    if (!open || isMobile) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close, isMobile]);

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  if (!open || !mounted) return null;

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={close}
        title={title}
        zIndex={CONFIRMATION_MODAL_Z_INDEX}
        panelClassName="confirmation-modal"
        showClose={false}
        showDragHandle
        enableDragDismiss={!isLoading}
        dragMode="handle"
        ariaLabel={title}
      >
        <ConfirmationBody
          title={title}
          description={description}
          highlight={highlight}
          details={details}
          confirmText={confirmText}
          cancelText={cancelText}
          variant={variant}
          isLoading={isLoading}
          close={close}
          handleConfirm={() => void handleConfirm()}
          showHeaderClose={false}
          hideTitle
        />
      </BottomSheet>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: CONFIRMATION_MODAL_Z_INDEX }}
    >
      <div
        className="absolute inset-0 overlay-scrim backdrop-blur-[3px]"
        onClick={close}
        aria-hidden
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className={cn(
          'confirmation-modal relative w-full md:max-w-md bg-bg-panel border border-border-glass modal-panel shadow-2xl',
          'rounded-2xl',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <ConfirmationBody
          title={title}
          description={description}
          highlight={highlight}
          details={details}
          confirmText={confirmText}
          cancelText={cancelText}
          variant={variant}
          isLoading={isLoading}
          close={close}
          handleConfirm={() => void handleConfirm()}
        />
      </div>
    </div>,
    document.body
  );
}