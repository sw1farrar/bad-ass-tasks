'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Emphasized item name shown inside the description area */
  highlight?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  highlight,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  isLoading = false,
}: ConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    if (!isLoading) onOpenChange(false);
  }, [isLoading, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[850] flex items-end md:items-center justify-center p-0 md:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={close}
        aria-hidden
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className={cn(
          'relative w-full md:max-w-md bg-[#0f0f12] border border-white/10 shadow-2xl',
          'rounded-t-2xl md:rounded-2xl',
          'pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-0',
          'animate-in fade-in slide-in-from-bottom-4 md:zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 md:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
        </div>

        <div className="flex items-start gap-3 p-5 pb-4">
          {variant === 'destructive' && (
            <div className="mt-0.5 rounded-xl bg-[#ff3366]/10 p-2 shrink-0">
              <AlertTriangle className="h-5 w-5 text-[#ff3366]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3
              id="confirm-dialog-title"
              className="text-base sm:text-lg font-semibold text-white tracking-tight"
            >
              {title}
            </h3>
            {(description || highlight) && (
              <div id="confirm-dialog-desc" className="mt-2 space-y-1.5">
                {highlight && (
                  <p className="text-sm font-medium text-[#f4f4f5] truncate">
                    &ldquo;{highlight}&rdquo;
                  </p>
                )}
                {description && (
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">{description}</p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isLoading}
            className="text-[#71717a] hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 transition shrink-0 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col-reverse md:flex-row gap-2.5 px-5 pb-5">
          <button
            type="button"
            onClick={close}
            disabled={isLoading}
            className="flex-1 min-h-[44px] rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#e4e4e7] hover:bg-white/5 disabled:opacity-50 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              'flex-1 min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition',
              variant === 'destructive'
                ? 'bg-[#ff3366] hover:bg-[#e62958] text-white'
                : 'bg-[#c084fc] hover:bg-[#a855f7] text-black'
            )}
          >
            {isLoading ? 'Processing…' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}