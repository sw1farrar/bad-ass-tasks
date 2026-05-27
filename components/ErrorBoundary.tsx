"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Bug, Copy, RotateCcw, Home } from "lucide-react";
import { logger, getRecentErrors } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Root ErrorBoundary for Bad Ass Tasks (Agent 33 hardened).
 * Catches unexpected React render errors anywhere in the tree.
 * Provides graceful, on-brand fallback UI instead of white screen / broken state.
 * 
 * Production improvements:
 * - Leverages enhanced logger: auto-buffers to diagnostics + pluggable reporters (Sentry-ready).
 * - Improved report UX: attempts Clipboard API (copy JSON report) + better guidance.
 * - "Reset component" button for recoverable errors (no full reload).
 * - "Go home" recovery option.
 * - Full a11y: aria labels, roles, keyboard operable buttons.
 * - Shows recent error count from buffer for context.
 * 
 * Includes:
 * - Neon-themed error card matching the premium dark glassmorphism aesthetic.
 * - Data safety messaging (local + Supabase).
 * 
 * Usage: wrap in app/layout.tsx around {children}.
 * Does NOT catch errors in event handlers, async code, or SSR (use global-error.tsx for that if needed).
 * Call initErrorMonitoring() in layout for global JS error coverage.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
    // Ensure monitoring (buffer, globals, reporters) is active as soon as boundary mounts (root coverage)
    if (typeof window !== "undefined") {
      // Dynamic import to avoid any SSR issues though already client
      import("@/lib/logger").then(({ initErrorMonitoring }) => initErrorMonitoring()).catch(() => {});
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Agent 33: Structured logging + buffer + pluggable reporters (Sentry etc) via enhanced logger
    logger.error("Uncaught React render error (ErrorBoundary)", error, {
      componentStack: errorInfo?.componentStack,
      // Additional context for debugging production crashes
      boundary: "root",
    });
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    // Full reload is safest recovery for most app state corruption
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleReset = () => {
    // Soft reset: attempt to recover without full reload (useful for transient render issues)
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    logger.info("ErrorBoundary soft reset attempted by user");
  };

  handleGoHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  handleReport = async () => {
    const { error, errorInfo } = this.state;
    const recent = getRecentErrors(5);
    const report = {
      message: error?.message || "Unknown error",
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      url: typeof window !== "undefined" ? window.location.href : "unknown",
      recentErrors: recent.map((e) => ({ id: e.id, msg: e.message, ts: e.timestamp })),
    };

    // Structured production-safe logging (always)
    logger.group("Error Report — copy this for support", () => {
      logger.error("User-initiated error report", undefined, report);
    });

    let copied = false;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        copied = true;
      } catch {
        // fallback below
      }
    }

    // Friendly, safe prompt (boundary cannot depend on sonner or complex UI)
    if (typeof window !== "undefined") {
      const base = copied
        ? "Full error report (incl. recent buffer) copied to clipboard!\n\n"
        : "Error details logged + buffered (open DevTools for full history via __BADASS_GET_ERRORS).\n\n";
      const msg = base +
        "Paste into GitHub issue or support.\n\n" +
        (copied ? "Report copied successfully. " : "") +
        "Click OK to reload now.";
      // eslint-disable-next-line no-alert
      alert(msg);
    }
    // Reload after report for clean recovery (user can cancel mentally)
    this.handleReload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-6">
          <div className="glass max-w-lg w-full rounded-2xl border border-white/10 p-8 text-center">
            <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-[#a1a1aa] mb-6 text-sm leading-relaxed">
              The app hit an unexpected error. Your data is safe (saved locally or in Supabase).
              <br />
              A reload usually fixes it.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                aria-label="Reload the application to recover from error"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ff9f] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#00ff9f]/90 active:scale-[0.985]"
              >
                <RefreshCw className="h-4 w-4" />
                Reload page
              </button>

              <button
                onClick={this.handleReset}
                aria-label="Attempt soft reset without full page reload"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 active:scale-[0.985]"
              >
                <RotateCcw className="h-4 w-4" />
                Try reset
              </button>

              <button
                onClick={this.handleReport}
                aria-label="Copy detailed error report to clipboard and reload"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 active:scale-[0.985]"
              >
                <Bug className="h-4 w-4" />
                Report issue
              </button>

              <button
                onClick={this.handleGoHome}
                aria-label="Navigate to home page"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm font-medium text-white transition hover:bg-white/10 active:scale-[0.985]"
              >
                <Home className="h-4 w-4" />
                Home
              </button>
            </div>

            {/* Agent 33: Show buffer context (production value even in prod for support) */}
            {logger.getErrorBuffer && logger.getErrorBuffer().length > 0 && (
              <p className="mt-3 text-[10px] text-[#71717a]">
                {logger.getErrorBuffer().length} recent error{logger.getErrorBuffer().length > 1 ? "s" : ""} buffered for diagnostics.
              </p>
            )}

            {process.env.NODE_ENV !== "production" && this.state.error && (
              <details className="mt-6 text-left text-xs text-[#71717a] border-t border-white/10 pt-4" aria-label="Technical error details for developers">
                <summary className="cursor-pointer hover:text-[#a1a1aa] select-none focus:outline-none focus:ring-1 focus:ring-white/30 rounded">
                  Technical details (dev only) — {this.state.error.name || "Error"}
                </summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-3 font-mono text-[10px] text-red-400/80" role="log" aria-live="polite">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                  {this.state.errorInfo?.componentStack && "\n\nComponent stack:\n" + this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <p className="mt-6 text-[10px] text-[#52525b]">
              Bad Ass Tasks • Your data is safe. Open DevTools console or use __BADASS_GET_ERRORS() for full buffer. Check Supabase/network if persistent.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
