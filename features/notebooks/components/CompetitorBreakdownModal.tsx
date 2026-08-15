"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Building2, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/BottomSheet";
import type { Notebook, NotebookCompetitor, NotebookCompetitorNote } from "@/types";
import {
  buildWorkspaceCompetitorBreakdown,
  competitorColorClass,
  normalizeCompetitorName,
} from "@/lib/notebooks/competitorAggregates";
import {
  formatCompetitorCurrency,
  formatCompetitorShare,
  MarketShareBar,
  MarketShareDonut,
} from "./MarketShareVisuals";

interface CompetitorBreakdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusCompetitorName?: string;
  competitors: NotebookCompetitor[];
  notebooks: Notebook[];
  notes?: NotebookCompetitorNote[];
  workspaceName?: string;
}

export function CompetitorBreakdownModal({
  open,
  onOpenChange,
  focusCompetitorName,
  competitors,
  notebooks,
  notes = [],
  workspaceName,
}: CompetitorBreakdownModalProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const breakdown = useMemo(
    () => buildWorkspaceCompetitorBreakdown(competitors, notebooks, notes),
    [competitors, notebooks, notes],
  );

  const selectedCompetitor = useMemo(
    () => breakdown.aggregatedCompetitors.find((c) => c.key === selectedKey) ?? null,
    [breakdown.aggregatedCompetitors, selectedKey],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedKey(
      focusCompetitorName ? normalizeCompetitorName(focusCompetitorName) : null,
    );
  }, [open, focusCompetitorName]);

  useEffect(() => {
    if (!open || !selectedKey) return;
    const el = cardRefs.current[selectedKey];
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }, [open, selectedKey]);

  const donutSegments = useMemo(() => {
    const segments = [
      {
        id: "our-sales",
        value: breakdown.totalOurSales,
        colorClass: "bg-neon-purple/80",
        label: "Our sales",
      },
      ...breakdown.aggregatedCompetitors.map((competitor, index) => ({
        id: competitor.key,
        value: competitor.totalSalesPotential,
        colorClass: competitorColorClass(index),
        label: competitor.name,
      })),
    ];
    return segments.filter((s) => s.value > 0);
  }, [breakdown]);

  return (
    <BottomSheet
      open={open}
      onClose={() => onOpenChange(false)}
      showClose={false}
      wrapChildrenInScroll={false}
      desktopMaxWidth="max-w-5xl"
      zIndex={1000}
      panelClassName="competitor-breakdown-modal"
      ariaLabel="Competitor breakdown"
    >
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="shrink-0 flex items-start justify-between gap-4 px-5 py-4 border-b border-border-glass bg-bg-secondary/60">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <Building2 className="h-4 w-4 shrink-0" />
              Workspace competitor intelligence
            </div>
            <h2 id="competitor-breakdown-title" className="text-xl sm:text-2xl font-bold text-text-primary mt-1 truncate">
              {selectedCompetitor ? selectedCompetitor.name : "All competitors"}
            </h2>
            <p className="text-sm text-text-muted mt-1">
              Cumulative breakdown across {breakdown.activeNotebookCount} notebook
              {breakdown.activeNotebookCount === 1 ? "" : "s"}
              {workspaceName ? ` in ${workspaceName}` : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {breakdown.aggregatedCompetitors.length > 0 && (
          <div className="shrink-0 px-5 py-3 border-b border-border-glass bg-bg/80">
            <p className="text-[10px] uppercase tracking-wide text-text-faint mb-2">
              Select competitor
            </p>
            <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium border transition",
                  selectedKey === null
                    ? "border-neon-purple/40 bg-neon-purple/12 text-neon-purple-tint"
                    : "border-border-glass bg-bg-secondary text-text-secondary hover:bg-surface-hover",
                )}
              >
                All
              </button>
              {breakdown.aggregatedCompetitors.map((competitor, index) => (
                <button
                  key={competitor.key}
                  type="button"
                  onClick={() => setSelectedKey(competitor.key)}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition max-w-[14rem]",
                    selectedKey === competitor.key
                      ? "border-neon-purple/40 bg-neon-purple/12 text-neon-purple-tint"
                      : "border-border-glass bg-bg-secondary text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  <span
                    className={cn("h-2 w-2 rounded-full shrink-0", competitorColorClass(index))}
                  />
                  <span className="truncate">{competitor.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-5 space-y-6">
            {selectedCompetitor && (
              <div className="rounded-xl border border-neon-purple/30 bg-neon-purple/5 px-4 py-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-faint">
                    {selectedCompetitor.name} — total sales
                  </div>
                  <div className="text-lg font-bold text-text-primary tabular-nums mt-0.5">
                    {formatCompetitorCurrency(selectedCompetitor.totalSalesPotential)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-faint">
                    Workspace share
                  </div>
                  <div className="text-lg font-bold text-text-primary tabular-nums mt-0.5">
                    {formatCompetitorShare(selectedCompetitor.shareOfMarket)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-faint">
                    Notebooks
                  </div>
                  <div className="text-lg font-bold text-text-primary tabular-nums mt-0.5">
                    {selectedCompetitor.notebooks.length}
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Our sales (all notebooks)",
                  value: formatCompetitorCurrency(breakdown.totalOurSales),
                  accent: "text-neon-purple-tint",
                },
                {
                  label: "Competitor sales",
                  value: formatCompetitorCurrency(breakdown.totalCompetitorSales),
                  accent: "text-text-primary",
                },
                {
                  label: "Combined market",
                  value: formatCompetitorCurrency(breakdown.totalMarket),
                  accent: "text-text-primary",
                },
                {
                  label: "Our market share",
                  value: formatCompetitorShare(breakdown.ourMarketShare),
                  accent: "text-neon-purple-tint",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border-glass bg-bg-secondary px-4 py-3"
                >
                  <div className="text-[10px] uppercase tracking-wide text-text-faint">
                    {stat.label}
                  </div>
                  <div className={cn("text-xl font-bold mt-1 tabular-nums", stat.accent)}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border-glass bg-bg-secondary p-5">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <MarketShareDonut segments={donutSegments} size={180} className="mx-auto lg:mx-0" />
                <div className="flex-1 min-w-0 space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-neon-purple-tint" />
                    <h3 className="text-sm font-semibold text-text-primary">Market composition</h3>
                  </div>
                  <MarketShareBar segments={donutSegments} heightClass="h-4" />
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <span className="flex items-center gap-1.5 text-xs text-text-muted">
                      <span className="h-2.5 w-2.5 rounded-full bg-neon-purple/80" />
                      Us — {formatCompetitorShare(breakdown.ourMarketShare)}
                    </span>
                    {breakdown.aggregatedCompetitors.map((competitor, index) => (
                      <button
                        key={competitor.key}
                        type="button"
                        onClick={() => setSelectedKey(competitor.key)}
                        className={cn(
                          "flex items-center gap-1.5 text-xs transition rounded-md px-1 py-0.5 -mx-1",
                          selectedKey === competitor.key
                            ? "text-neon-purple-tint bg-neon-purple/10"
                            : "text-text-muted hover:text-text-secondary hover:bg-surface-hover",
                        )}
                      >
                        <span
                          className={cn("h-2.5 w-2.5 rounded-full", competitorColorClass(index))}
                        />
                        {competitor.name} — {formatCompetitorShare(competitor.shareOfMarket)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary px-0.5">
                Competitor breakdown
              </h3>
              {breakdown.aggregatedCompetitors.length === 0 ? (
                <p className="text-sm text-text-muted px-0.5">
                  No competitors tracked across notebooks yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {breakdown.aggregatedCompetitors
                    .filter((competitor) => !selectedKey || competitor.key === selectedKey)
                    .map((competitor) => {
                    const index = breakdown.aggregatedCompetitors.findIndex(
                      (c) => c.key === competitor.key,
                    );
                    const isSelected = competitor.key === selectedKey;
                    return (
                      <div
                        key={competitor.key}
                        ref={(el) => {
                          cardRefs.current[competitor.key] = el;
                        }}
                        className={cn(
                          "rounded-xl border bg-bg-secondary overflow-hidden transition",
                          isSelected
                            ? "border-neon-purple/40 ring-1 ring-neon-purple/20"
                            : "border-border-glass hover:border-border-glass/80",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedKey(competitor.key)}
                          className="w-full px-4 py-3 border-b border-border-glass flex flex-wrap items-center justify-between gap-3 text-left hover:bg-surface-hover/40 transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-3 w-3 rounded-full shrink-0",
                                  competitorColorClass(index),
                                )}
                              />
                              <h4 className="text-base font-semibold text-text-primary truncate">
                                {competitor.name}
                              </h4>
                              {isSelected && (
                                <span className="text-[10px] uppercase tracking-wide text-neon-purple-tint font-semibold">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-muted mt-1 tabular-nums">
                              {formatCompetitorCurrency(competitor.totalSalesPotential)} total ·{" "}
                              {formatCompetitorShare(competitor.shareOfMarket)} of workspace market ·{" "}
                              {competitor.notebooks.length} notebook
                              {competitor.notebooks.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <MarketShareBar
                            className="w-full sm:w-48 pointer-events-none"
                            heightClass="h-2"
                            segments={[
                              {
                                id: "competitor",
                                value: competitor.totalSalesPotential,
                                colorClass: competitorColorClass(index),
                                label: competitor.name,
                              },
                              {
                                id: "rest",
                                value: Math.max(
                                  0,
                                  breakdown.totalMarket - competitor.totalSalesPotential,
                                ),
                                colorClass: "bg-text-faint/20",
                                label: "Rest of market",
                              },
                            ]}
                          />
                        </button>
                        <div className="divide-y divide-border-glass">
                          {competitor.notebooks.map((row) => (
                            <div
                              key={row.competitorId}
                              className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-4 py-2.5 text-sm"
                            >
                              <div className="font-medium text-text-primary truncate">
                                {row.notebookName}
                              </div>
                              <div className="text-text-muted tabular-nums">
                                Sales potential:{" "}
                                <span className="text-text-primary font-medium">
                                  {formatCompetitorCurrency(row.salesPotential)}
                                </span>
                              </div>
                              <div className="text-text-muted tabular-nums">
                                Our sales:{" "}
                                <span className="text-neon-purple-tint font-medium">
                                  {formatCompetitorCurrency(row.ourSales)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}