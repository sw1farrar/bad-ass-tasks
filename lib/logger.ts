/** Production-grade lightweight logger + observability (see full docs in source). */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

/** Global hooks exposed on window for external observability integrations. */
interface BadazzTasksWindow extends Window {
  __BADAZZ_REPORT_ERROR__?: (message: string, error?: Error | unknown, context?: LogContext) => void;
  __BADAZZ_METRIC__?: (metric: MetricReport) => void;
  __BADAZZ_MONITORING_INIT__?: boolean;
  __BADAZZ_GET_ERRORS?: () => ErrorReport[];
  __BADAZZ_CLEAR_ERRORS?: () => void;
  __BADAZZ_REPORT_METRIC?: (name: string, value: number, tags?: Record<string, string | number>) => void;
  __BADAZZ_PERF_INIT__?: boolean;
}

interface LCPEntry extends PerformanceEntry {
  renderTime?: number;
  loadTime?: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
  hadRecentInput?: boolean;
  value: number;
}

function getBadazzWindow(): BadazzTasksWindow | undefined {
  return typeof window !== 'undefined' ? (window as BadazzTasksWindow) : undefined;
}

// === Production Observability Types (Agent 33) ===
export interface ErrorReport {
  id: string;
  timestamp: string;
  message: string;
  error?: { message: string; stack?: string; name?: string };
  context?: LogContext;
  url?: string;
  userAgent?: string;
}

export interface MetricReport {
  name: string;
  value: number;
  timestamp: string;
  tags?: Record<string, string | number>;
}

const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
// isBrowser available for future conditional logic (kept for extensibility)

// Lightweight ring buffer for recent errors (in-memory + optional localStorage persistence for "report issue" flows)
const ERROR_BUFFER_KEY = 'badazz-tasks-error-buffer';
const MAX_ERROR_BUFFER = 50;
let errorBuffer: ErrorReport[] = [];
const reporters: Array<(report: ErrorReport) => void> = [];

function loadErrorBuffer(): ErrorReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ERROR_BUFFER_KEY);
    return raw ? JSON.parse(raw).slice(-MAX_ERROR_BUFFER) : [];
  } catch {
    return [];
  }
}

function persistErrorBuffer() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ERROR_BUFFER_KEY, JSON.stringify(errorBuffer.slice(-MAX_ERROR_BUFFER)));
  } catch {
    // quota / private mode — non-fatal
  }
}

function pushErrorReport(report: ErrorReport) {
  errorBuffer.push(report);
  if (errorBuffer.length > MAX_ERROR_BUFFER) errorBuffer.shift();
  persistErrorBuffer();
  // Notify all registered reporters (Sentry etc)
  reporters.forEach((r) => {
    try { r(report); } catch { /* reporter must never throw */ }
  });
}

function generateReportId(): string {
  return 'err_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

/** Browser noise that should not be logged as an application error. */
export function isBenignBrowserError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes('resizeobserver loop completed with undelivered notifications') ||
    normalized.includes('resizeobserver loop limit exceeded') ||
    normalized.includes('non-error promise rejection captured') ||
    normalized.includes("blocked script execution in 'about:srcdoc'") ||
    normalized.includes('because the document\'s frame is sandboxed and the \'allow-scripts\' permission is not set')
  );
}

// === End Observability internals ===

function formatMessage(level: LogLevel, message: string, context?: LogContext | Error | unknown): string {
  const prefix = `[BadAssTasks:${level.toUpperCase()}]`;
  const ts = new Date().toISOString();
  let extra = '';
  if (context) {
    if (context instanceof Error) {
      extra = ` | ${context.message}${context.stack ? '\n' + context.stack : ''}`;
    } else if (typeof context === 'object') {
      try {
        extra = ' | ' + JSON.stringify(context, null, isProd ? 0 : 2);
      } catch {
        extra = ' | [unserializable context]';
      }
    } else {
      extra = ` | ${String(context)}`;
    }
  }
  return `${prefix} ${ts} ${message}${extra}`;
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (!isProd) {
      // eslint-disable-next-line no-console
      console.debug(formatMessage('debug', message, context));
    }
  },

  info(message: string, context?: LogContext) {
    // Always surface info in dev; in prod surface key lifecycle (hosting captures stdout)
    // eslint-disable-next-line no-console
    console.info(formatMessage('info', message, context));
  },

  warn(message: string, context?: LogContext | unknown) {
    // eslint-disable-next-line no-console
    console.warn(formatMessage('warn', message, context));
  },

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const combined = error ? { ...(context || {}), error: error instanceof Error ? { message: error.message, stack: error.stack } : error } : context;
    // Always log errors - critical for prod observability (even minimal)
    // eslint-disable-next-line no-console
    console.error(formatMessage('error', message, combined));

    // Agent 33: Always buffer + notify pluggable reporters (Sentry-ready, no dep required)
    if (typeof window !== 'undefined') {
      const report: ErrorReport = {
        id: generateReportId(),
        timestamp: new Date().toISOString(),
        message,
        error: error instanceof Error
          ? { message: error.message, stack: error.stack, name: error.name }
          : (error ? { message: String(error) } : undefined),
        context: context as LogContext | undefined,
        url: window.location?.href,
        userAgent: navigator?.userAgent,
      };
      pushErrorReport(report);
    }

    // Legacy global hook still supported for external scripts (non-breaking)
    const badazzWindow = getBadazzWindow();
    if (badazzWindow?.__BADAZZ_REPORT_ERROR__) {
      try { badazzWindow.__BADAZZ_REPORT_ERROR__(message, error, context); } catch {}
    }
  },

  // Grouped logging for complex reports (e.g. ErrorBoundary)
  group(label: string, fn: () => void) {
    if (!isProd) {
      // eslint-disable-next-line no-console
      console.groupCollapsed(`[BadAssTasks] ${label}`);
      fn();
      // eslint-disable-next-line no-console
      console.groupEnd();
    } else {
      fn(); // still execute but no grouping noise in prod
    }
  },

  // === Agent 33: Observability extensions (lightweight, zero-dep foundation) ===
  /** Get recent buffered errors (for diagnostics UI, copy-to-report, or manual export) */
  getErrorBuffer(): ErrorReport[] {
    return [...errorBuffer];
  },

  /** Clear buffered errors (e.g. after successful remote flush or user action) */
  clearErrorBuffer() {
    errorBuffer = [];
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(ERROR_BUFFER_KEY); } catch {}
    }
  },

  /** Register a reporter fn called on every error (supports multiple; e.g. Sentry.captureException) */
  registerErrorReporter(reporter: (report: ErrorReport) => void) {
    if (typeof reporter === 'function' && !reporters.includes(reporter)) {
      reporters.push(reporter);
    }
  },

  /** Report a custom performance / business metric (value in ms, count, etc). Logged + available for future dashboards. */
  reportMetric(name: string, value: number, tags?: Record<string, string | number>) {
    const metric: MetricReport = { name, value, timestamp: new Date().toISOString(), tags };
    // Always surface metrics in dev; in prod still console for hosting + future aggregation
    // eslint-disable-next-line no-console
    console.info(`[BadAssTasks:METRIC] ${name}=${value}`, tags || '');
    // Buffer metrics? (light: only errors for now; metrics are firehose to console/logger consumers)
    const badazzWindow = getBadazzWindow();
    if (badazzWindow?.__BADAZZ_METRIC__) {
      try { badazzWindow.__BADAZZ_METRIC__(metric); } catch {}
    }
  },
};

export type { LogContext };

// Convenience for common patterns
export function logError(operation: string, err: unknown, extra?: LogContext) {
  logger.error(`Operation failed: ${operation}`, err, extra);
}

/**
 * Initialize production error + perf monitoring (call once in root layout, client-side).
 * Sets up global JS error handlers (catches event handler/async errors boundaries miss).
 * Idempotent. Wires buffer + any pre-registered reporters.
 */
export function initErrorMonitoring() {
  const badazzWindow = getBadazzWindow();
  if (!badazzWindow) return;
  if (badazzWindow.__BADAZZ_MONITORING_INIT__) return;
  badazzWindow.__BADAZZ_MONITORING_INIT__ = true;

  // Load any persisted buffer
  errorBuffer = loadErrorBuffer();

  // Global error handlers for full coverage (beyond React ErrorBoundary)
  const handleWindowError = (event: ErrorEvent) => {
    const message = event.error instanceof Error ? event.error.message : event.message;
    if (isBenignBrowserError(message)) {
      event.preventDefault();
      return;
    }

    logger.error('Unhandled window error', event.error || new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };
  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (isBenignBrowserError(message)) {
      event.preventDefault();
      return;
    }

    logger.error('Unhandled promise rejection', reason instanceof Error ? reason : new Error(message), {
      reason: reason,
    });
  };

  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleRejection);

  // Expose for advanced external tools / debugging (non-breaking extension)
  badazzWindow.__BADAZZ_GET_ERRORS = () => logger.getErrorBuffer();
  badazzWindow.__BADAZZ_CLEAR_ERRORS = () => logger.clearErrorBuffer();
  badazzWindow.__BADAZZ_REPORT_METRIC = (n: string, v: number, t?: Record<string, string | number>) =>
    logger.reportMetric(n, v, t);

  logger.info('Error monitoring initialized (global handlers + buffer + reporter hooks active)');

  // Also kick lightweight perf monitoring (native Performance API)
  initPerformanceMonitoring();
}

/**
 * Initialize performance metrics collection using native browser APIs (LCP, FID/INP proxy, CLS, custom).
 * Reports via logger.reportMetric (visible in console + future sinks). Idempotent, zero-dep.
 * Call is internal from initErrorMonitoring; safe to call directly too.
 */
export function initPerformanceMonitoring() {
  const badazzWindow = getBadazzWindow();
  if (!badazzWindow || badazzWindow.__BADAZZ_PERF_INIT__) return;
  badazzWindow.__BADAZZ_PERF_INIT__ = true;

  try {
    // Core Web Vitals via PerformanceObserver (widely supported in modern browsers)
    if ('PerformanceObserver' in window) {
      // LCP
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as LCPEntry | undefined;
        if (last) logger.reportMetric('web_vital_lcp', Math.round(last.renderTime || last.loadTime || last.startTime), { type: 'LCP' });
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });

      // CLS
      let clsValue = 0;
      const clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LayoutShiftEntry[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        logger.reportMetric('web_vital_cls', Math.round(clsValue * 1000) / 1000, { type: 'CLS' });
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });

      // Long tasks / INP proxy (approx input delay + processing)
      const longTaskObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          logger.reportMetric('perf_long_task', Math.round(entry.duration), { name: entry.name, start: Math.round(entry.startTime) });
        }
      });
      try { longTaskObs.observe({ type: 'longtask', buffered: true }); } catch {}

      // Navigation timing (TTFB, etc)
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (nav) {
        logger.reportMetric('perf_ttfb', Math.round(nav.responseStart - nav.requestStart));
        logger.reportMetric('perf_dom_load', Math.round(nav.domContentLoadedEventEnd - nav.startTime));
      }
    }

    // Custom marks for app flows (call logger.reportMetric or performance.mark + measure in code)
    logger.info('Performance monitoring initialized (native Web Vitals + long tasks + custom metrics)');
  } catch (e) {
    // Non-fatal in old browsers
    logger.debug('Perf monitoring partial init (ok)', e as LogContext | undefined);
  }
}

/** Convenience: time a function / promise and report metric automatically. */
export async function timeOperation<T>(name: string, fn: () => Promise<T> | T, tags?: Record<string, string | number>): Promise<T> {
  const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  try {
    const res = await Promise.resolve(fn());
    const dur = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - start);
    logger.reportMetric(name, dur, { ...tags, status: 'ok' });
    return res;
  } catch (err) {
    const dur = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - start);
    logger.reportMetric(name, dur, { ...tags, status: 'error' });
    throw err;
  }
}

/** Helper to get last N errors (convenience) */
export function getRecentErrors(limit = 10): ErrorReport[] {
  return logger.getErrorBuffer().slice(-limit);
}

/** Top-level re-export of reportMetric for module consumers and tests (hygiene for observability API surface) */
export const reportMetric = logger.reportMetric;

export default logger;
