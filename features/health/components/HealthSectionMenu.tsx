"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { HEALTH_SECTION_TABS, type HealthSectionTab } from "@/lib/health/healthSections";

interface HealthSectionMenuProps {
  activeTab: HealthSectionTab;
  onTabChange: (tab: HealthSectionTab) => void;
}

export function HealthSectionMenu({ activeTab, onTabChange }: HealthSectionMenuProps) {
  const navRef = useRef<HTMLElement>(null);
  const firstPaint = useRef(true);

  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: firstPaint.current ? "auto" : "smooth",
    });
    firstPaint.current = false;
  }, [activeTab]);

  return (
    <nav
      ref={navRef}
      className="health-section-menu flex w-full items-stretch gap-1.5 px-3 py-2 border-b border-border-glass bg-bg shrink-0 max-md:overflow-x-auto max-md:touch-pan-x"
      aria-label="Health sections"
      role="tablist"
    >
      {HEALTH_SECTION_TABS.map((tab) => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "health-section-menu__btn flex items-center justify-center min-w-0 min-h-[44px] px-3 max-md:px-2.5 py-2 rounded-lg text-xs max-md:text-[11px] sm:text-sm font-semibold leading-tight text-center whitespace-nowrap transition max-md:flex-none md:flex-1",
              selected
                ? "bg-neon-purple/12 text-neon-purple-tint border border-neon-purple/25"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}