'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Next.js global-error.tsx (root)
 * Catches errors during server rendering, in root layout, and uncaught async errors
 * that the client ErrorBoundary (in layout) cannot catch.
 * 
 * Provides consistent branded fallback across production crashes.
 * Data safety note: same as client boundary.
 * 
 * See: https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log immediately for observability (prod + dev)
  React.useEffect(() => {
    logger.error('Global app error (SSR / root layout / async boundary)', error, {
      digest: error.digest,
      isProduction: process.env.NODE_ENV === 'production',
    });
  }, [error]);

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleReport = () => {
    const report = {
      message: error?.message || 'Unknown global error',
      stack: error?.stack,
      digest: error?.digest,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };

    logger.group('Global Error Report — copy for support', () => {
      logger.error('Global error details', error, report);
    });

    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-alert
      alert(
        'Error details logged to console (open DevTools).\n\n' +
          'Copy and report the error + stack/digest.\n\n' +
          'Click OK to reload.'
      );
    }
    handleReload();
  };

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-[#f4f4f5] antialiased">
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-6">
          <div className="glass max-w-lg w-full rounded-2xl border border-white/10 p-8 text-center">
            <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">
              Critical error
            </h1>
            <p className="text-[#a1a1aa] mb-6 text-sm leading-relaxed">
              The app encountered a serious error during loading or an async operation.
              Your tasks and notes are safe (local + Supabase).
              <br />
              A full reload usually recovers the session.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset} // Next.js reset attempts to re-render the segment
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ff9f] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#00ff9f]/90 active:scale-[0.985]"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>

              <button
                onClick={handleReload}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 active:scale-[0.985]"
              >
                <RefreshCw className="h-4 w-4" />
                Full reload
              </button>

              <button
                onClick={handleReport}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 active:scale-[0.985]"
              >
                <Bug className="h-4 w-4" />
                Report issue
              </button>
            </div>

            {process.env.NODE_ENV !== 'production' && error && (
              <details className="mt-6 text-left text-xs text-[#71717a] border-t border-white/10 pt-4">
                <summary className="cursor-pointer hover:text-[#a1a1aa] select-none">
                  Technical details (dev only) — digest: {error.digest || 'n/a'}
                </summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-3 font-mono text-[10px] text-red-400/80">
                  {error.message}
                  {'\n\n'}
                  {error.stack}
                </pre>
              </details>
            )}

            <p className="mt-6 text-[10px] text-[#52525b]">
              Badazz Tasks • Check Supabase config, network, or console for clues.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
