"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_OPTIONS, type ThemeMode } from "@/lib/themePreferences";
import { useTaskStore } from "@/store/useTaskStore";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
  /** Called after the user picks a theme (e.g. close profile popover). */
  onThemeChange?: () => void;
}

export function ThemeToggle({ className, compact = false, onThemeChange }: ThemeToggleProps) {
  const theme = useTaskStore((s) => s.theme);
  const setTheme = useTaskStore((s) => s.setTheme);

  const selectTheme = (mode: ThemeMode) => {
    setTheme(mode);
    onThemeChange?.();
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted">Appearance</div>
          {!compact && (
            <p className="text-[11px] text-text-secondary mt-0.5">Switch the whole app between dark and light.</p>
          )}
        </div>
      </div>
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label="Color theme"
      >
        {THEME_OPTIONS.map((option) => {
          const active = theme === option.mode;
          const Icon = option.mode === "dark" ? Moon : Sun;
          return (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => selectTheme(option.mode)}
              className={cn(
                "min-h-[44px] rounded-xl border px-3 py-2.5 text-left transition",
                active
                  ? "border-[var(--accent-purple-border)] bg-[var(--accent-purple-subtle)] text-neon-purple-tint shadow-sm"
                  : "border-border bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary hover:border-border",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 shrink-0" />
                {option.label}
              </span>
              {!compact && (
                <span className="mt-1 block text-[10px] text-text-muted leading-snug">
                  {option.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThemeToggleSegmented({
  className,
  onThemeChange,
}: {
  className?: string;
  onThemeChange?: () => void;
}) {
  const theme = useTaskStore((s) => s.theme);
  const setTheme = useTaskStore((s) => s.setTheme);

  const setMode = (mode: ThemeMode) => {
    setTheme(mode);
    onThemeChange?.();
  };

  return (
    <div
      className={cn(
        "inline-flex w-full rounded-xl border border-border-glass bg-surface-hover p-1",
        className,
      )}
      role="radiogroup"
      aria-label="Color theme"
    >
      {THEME_OPTIONS.map((option) => {
        const active = theme === option.mode;
        const Icon = option.mode === "dark" ? Moon : Sun;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(option.mode)}
            className={cn(
              "flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition",
              active
                ? "bg-bg-secondary text-text-primary shadow-sm border border-border-glass"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}