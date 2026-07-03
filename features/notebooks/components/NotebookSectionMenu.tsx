"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  NOTEBOOK_SECTION_TABS,
  type NotebookSectionTab,
} from "@/lib/notebooks/notebookSections";

export type { NotebookSectionTab };

interface NotebookSectionMenuProps {
  activeTab: NotebookSectionTab;
  onTabChange: (tab: NotebookSectionTab) => void;
}

export function NotebookSectionMenu({ activeTab, onTabChange }: NotebookSectionMenuProps) {
  return (
    <nav
      className="notebooks-section-menu flex w-full items-stretch gap-1.5 px-3 py-2 border-b border-border-glass bg-bg shrink-0 max-md:overflow-x-auto max-md:snap-x max-md:touch-pan-x"
      aria-label="Notebook sections"
    >
      {NOTEBOOK_SECTION_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "notebooks-section-menu__btn flex items-center justify-center min-w-0 min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold leading-tight text-center whitespace-nowrap transition max-md:flex-none max-md:snap-start md:flex-1",
            activeTab === tab.id
              ? "bg-neon-purple/12 text-neon-purple-tint border border-neon-purple/25"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent",
          )}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}