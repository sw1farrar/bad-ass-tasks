"use client";

import { X } from "lucide-react";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { MobileDrawerShell } from "@/components/MobileDrawerShell";
import { AuthPanel } from "@/components/AuthPanel";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/** @deprecated Prefer navigating to /login instead of the modal. */
export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const isMobile = useIsMobileViewport();

  if (!isOpen) return null;

  return (
    <MobileDrawerShell
      open={isOpen}
      onClose={onClose}
      isMobile={isMobile}
      zIndex={200}
      panelClassName="auth-modal-panel glass max-w-md md:max-w-lg p-6 md:p-8 relative overflow-auto md:max-h-[80vh]"
      ariaLabel="Sign in"
    >
      <button
        onClick={onClose}
        aria-label="Close sign in"
        className="absolute top-5 right-5 z-10 text-text-muted hover:text-text-primary"
      >
        <X className="h-5 w-5" />
      </button>
      <AuthPanel onSuccess={onSuccess} className="!bg-transparent !shadow-none !border-0 !p-0" />
    </MobileDrawerShell>
  );
}