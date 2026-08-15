"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { apiFetch } from "@/lib/api/apiFetch";
import {
  formatLoginEventDetail,
  formatLoginEventLabel,
  type LoginEventRow,
} from "@/lib/auth/loginActivityShared";
import { formatLocalTimestamp } from "@/lib/datetime";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/BottomSheet";

const MODAL_Z = 1000;

type LoginActivityModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled?: boolean;
};

function summarizeUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  if (/iPhone|iPad|iOS/i.test(ua)) return "iPhone / iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
  if (/CrOS/i.test(ua)) return "Chromebook";
  if (/Linux/i.test(ua)) return "Linux";
  return "Web browser";
}

function LoginActivityBody({
  events,
  loading,
  error,
  enabled,
  onRefresh,
  refreshing,
  onClose,
}: {
  events: LoginEventRow[];
  loading: boolean;
  error: string | null;
  enabled: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-border-glass">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-neon-purple shrink-0" />
            <h2 className="text-base font-semibold tracking-tight">Login activity</h2>
          </div>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Recent sign-ins and security events for your account. If something looks unfamiliar, sign out everywhere
            and reset your password.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition shrink-0"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-border-glass">
        <span className="text-[11px] uppercase tracking-widest text-text-muted">Your sessions</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!enabled || loading || refreshing}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-neon-purple disabled:opacity-40 transition"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {!enabled ? (
          <p className="text-sm text-text-muted py-8 text-center">
            Login activity is available when you&apos;re connected to the live app.
          </p>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-text-muted">
            <Loader2 className="h-6 w-6 animate-spin text-neon-purple" />
            <span className="text-sm">Loading login history…</span>
          </div>
        ) : error ? (
          <p className="text-sm text-[var(--priority-p0)] py-8 text-center">{error}</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center">
            No login events recorded yet. Failed sign-in attempts and verification prompts will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => {
              const device = summarizeUserAgent(event.userAgent);
              const detail = formatLoginEventDetail(event);
              return (
                <li
                  key={event.id}
                  className="rounded-xl border border-border-glass bg-surface-hover/40 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary">
                        {formatLoginEventLabel(event.eventType)}
                      </div>
                      {detail ? (
                        <div className="text-xs text-text-secondary mt-0.5 leading-snug">{detail}</div>
                      ) : null}
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {formatLocalTimestamp(event.createdAt)}
                        {event.authMethod ? ` · ${event.authMethod}` : ""}
                        {device ? ` · ${device}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-mono text-text-secondary">
                        {event.ipAddress ?? "IP hidden"}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function LoginActivityModal({ open, onOpenChange, enabled = true }: LoginActivityModalProps) {
  const isMobile = useIsMobileViewport();
  const [events, setEvents] = useState<LoginEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useScrollLock(open);

  const load = useCallback(
    async (silent = false) => {
      if (!enabled) {
        setEvents([]);
        setError(null);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await apiFetch("/api/auth/login-activity?limit=50");
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          events?: LoginEventRow[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        setEvents(data.events ?? []);
      } catch (e) {
        setEvents([]);
        setError(e instanceof Error ? e.message : "Could not load login activity");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const close = () => onOpenChange(false);

  if (!open) return null;

  const body = (
    <LoginActivityBody
      events={events}
      loading={loading}
      error={error}
      enabled={enabled}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      onClose={close}
    />
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={close} ariaLabel="Login activity">
        {body}
      </BottomSheet>
    );
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ zIndex: MODAL_Z }}>
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close login activity"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-activity-title"
        className="relative w-full max-w-lg max-h-[min(32rem,85dvh)] glass modal-panel rounded-2xl border border-border-glass shadow-2xl overflow-hidden flex flex-col"
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}