"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  DollarSign,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { cn } from "@/lib/utils";
import type {
  Notebook,
  NotebookCompetitor,
  NotebookCompetitorNote,
  WorkspaceMember,
} from "@/types";
import {
  getCompetitorNameSuggestions,
  isCompetitorNameInNotebook,
} from "@/lib/notebooks/competitorAggregates";
import { AddCompetitorModal } from "./AddCompetitorModal";
import { CompetitorBreakdownModal } from "./CompetitorBreakdownModal";
import {
  formatCompetitorCurrency,
  formatCompetitorShare,
  MarketShareBar,
} from "./MarketShareVisuals";
import { NotebookProgressComposer } from "./NotebookProgressComposer";
import { NotebookProgressTimeline } from "./NotebookProgressTimeline";

interface NotebookCompetitorsPanelProps {
  notebookId: string;
  competitors: NotebookCompetitor[];
  workspaceCompetitors: NotebookCompetitor[];
  workspaceCompetitorNotes: NotebookCompetitorNote[];
  notebooks: Notebook[];
  workspaceName?: string;
  notes: NotebookCompetitorNote[];
  members: WorkspaceMember[];
  currentUserId?: string;
  ourSales: number;
  selectedCompetitorId: string | null;
  onSelectCompetitor: (id: string | null) => void;
  onOurSalesChange: (value: number) => void | Promise<unknown>;
  onAdd: (name: string, salesPotential: number) => void | Promise<unknown>;
  onUpdate: (
    id: string,
    updates: { name?: string; salesPotential?: number },
  ) => void | Promise<unknown>;
  onRequestDelete: (id: string) => void;
  onAddNote: (competitorId: string, body: string) => void | Promise<unknown>;
  onUpdateNote: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteNote: (id: string) => void;
}

const dollarAmountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function parseDollarInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatDollarInput(value: number): string {
  if (!value) return "";
  return dollarAmountFormatter.format(value);
}

function formatDollarInputFromString(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return dollarAmountFormatter.format(Number(digits));
}

export function NotebookCompetitorsPanel({
  notebookId,
  competitors,
  workspaceCompetitors,
  workspaceCompetitorNotes,
  notebooks,
  workspaceName,
  notes,
  members,
  currentUserId,
  ourSales,
  selectedCompetitorId,
  onSelectCompetitor,
  onOurSalesChange,
  onAdd,
  onUpdate,
  onRequestDelete,
  onAddNote,
  onUpdateNote,
  onRequestDeleteNote,
}: NotebookCompetitorsPanelProps) {
  const isMobile = useIsMobileViewport();
  const [ourSalesInput, setOurSalesInput] = useState(formatDollarInput(ourSales));
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownFocusName, setBreakdownFocusName] = useState<string | undefined>();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  const nameSuggestions = useMemo(
    () => getCompetitorNameSuggestions(workspaceCompetitors, notebookId),
    [workspaceCompetitors, notebookId],
  );

  useEffect(() => {
    setOurSalesInput(formatDollarInput(ourSales));
  }, [ourSales]);

  useEffect(() => {
    if (selectedCompetitorId && !competitors.some((c) => c.id === selectedCompetitorId)) {
      onSelectCompetitor(null);
    }
  }, [competitors, selectedCompetitorId, onSelectCompetitor]);

  useEffect(() => {
    setIsRenaming(false);
    setRenameDraft("");
  }, [selectedCompetitorId]);

  const totalCompetitorSales = useMemo(
    () => competitors.reduce((sum, c) => sum + (c.salesPotential || 0), 0),
    [competitors],
  );

  const totalMarket = ourSales + totalCompetitorSales;
  const marketShare = totalMarket > 0 ? (ourSales / totalMarket) * 100 : 0;

  const noteCountByCompetitor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      counts.set(note.competitorId, (counts.get(note.competitorId) ?? 0) + 1);
    }
    return counts;
  }, [notes]);

  const marketBarSegments = useMemo(() => {
    const segments = [
      {
        id: "our-sales",
        value: ourSales,
        colorClass: "bg-neon-purple/80",
        label: "Our sales",
      },
      ...competitors.map((c) => ({
        id: c.id,
        value: c.salesPotential || 0,
        colorClass: "bg-text-faint/50",
        label: c.name,
      })),
    ];
    return segments.filter((s) => s.value > 0);
  }, [competitors, ourSales]);

  const selectedCompetitor = useMemo(
    () => competitors.find((c) => c.id === selectedCompetitorId) ?? null,
    [competitors, selectedCompetitorId],
  );

  const competitorNotes = useMemo(
    () =>
      selectedCompetitorId
        ? notes.filter((n) => n.competitorId === selectedCompetitorId)
        : [],
    [notes, selectedCompetitorId],
  );

  const selectedShare =
    selectedCompetitor && totalMarket > 0
      ? (selectedCompetitor.salesPotential / totalMarket) * 100
      : 0;

  const openBreakdown = (name?: string) => {
    setBreakdownFocusName(name);
    setBreakdownOpen(true);
  };

  const handleAdd = async (name: string, salesPotential: number) => {
    if (isCompetitorNameInNotebook(competitors, notebookId, name)) {
      throw new Error("This competitor is already in this notebook");
    }
    const result = await onAdd(name, salesPotential);
    if (result && typeof result === "object" && "id" in result) {
      onSelectCompetitor((result as NotebookCompetitor).id);
    }
  };

  const commitOurSales = () => {
    const value = parseDollarInput(ourSalesInput);
    setOurSalesInput(formatDollarInput(value));
    if (value !== ourSales) void onOurSalesChange(value);
  };

  const handleDollarInputChange = (raw: string, setter: (value: string) => void) => {
    setter(formatDollarInputFromString(raw));
  };

  const showMobileDetail = isMobile && !!selectedCompetitor;

  return (
    <div className="notebooks-section-panel flex flex-1 min-h-0 min-w-0">
      <div
        className={cn(
          "w-full md:w-80 lg:w-[22rem] shrink-0 flex flex-col min-h-0 border-r border-border-glass bg-bg",
          showMobileDetail && "hidden",
        )}
      >
        <div className="shrink-0 p-3 border-b border-border-glass space-y-3">
          <div className="rounded-xl border border-border-glass bg-bg-secondary p-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  Market share
                </div>
                <div className="text-3xl font-bold text-neon-purple-tint mt-1 tabular-nums leading-none">
                  {formatCompetitorShare(marketShare)}
                </div>
                <p className="text-xs text-text-faint mt-1.5 leading-relaxed">
                  {formatCompetitorCurrency(ourSales)} of {formatCompetitorCurrency(totalMarket)} total
                </p>
              </div>
              <label className="shrink-0 w-full sm:w-36 sm:min-w-[9rem]">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Our sales
                </span>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-faint" />
                  <input
                    value={ourSalesInput}
                    onChange={(e) => handleDollarInputChange(e.target.value, setOurSalesInput)}
                    onBlur={commitOurSales}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitOurSales();
                    }}
                    inputMode="numeric"
                    placeholder="$0"
                    className="w-full bg-bg border border-border-glass rounded-lg pl-7 pr-2 py-1.5 text-xs text-right focus:outline-none focus:border-neon-purple/40 tabular-nums"
                  />
                </div>
              </label>
            </div>
            <MarketShareBar segments={marketBarSegments} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-text-faint">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-neon-purple/80" />
                Us
              </span>
              {competitors.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-text-faint/50" />
                  Competitors
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-3 py-2.5 text-sm font-medium text-neon-purple-tint hover:bg-neon-purple/15 transition min-h-[40px]"
          >
            <Plus className="h-4 w-4" />
            Add competitor
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {competitors.length === 0 ? (
            <p className="text-sm text-text-muted px-4 py-6 text-center">
              No competitors yet. Add one to start mapping the market.
            </p>
          ) : (
            <ul className="py-1">
              {competitors.map((competitor) => {
                const share =
                  totalMarket > 0
                    ? (competitor.salesPotential / totalMarket) * 100
                    : 0;
                const noteCount = noteCountByCompetitor.get(competitor.id) ?? 0;
                const isSelected = selectedCompetitorId === competitor.id;

                return (
                  <li key={competitor.id}>
                    <button
                      type="button"
                      onClick={() => onSelectCompetitor(competitor.id)}
                      className={cn(
                        "files-list-item w-full text-left px-3 py-2.5 transition relative",
                        isSelected && "files-list-item--selected",
                        !isSelected && "hover:bg-surface-hover",
                      )}
                      aria-selected={isSelected}
                    >
                      <div className="flex items-start justify-between gap-2 relative z-[1]">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate text-text-primary">
                            {competitor.name}
                          </div>
                          <div className="text-xs text-text-muted mt-0.5 tabular-nums">
                            {formatCompetitorCurrency(competitor.salesPotential)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-semibold text-text-secondary tabular-nums">
                            {formatCompetitorShare(share)}
                          </div>
                          {noteCount > 0 && (
                            <div className="flex items-center justify-end gap-0.5 text-[10px] text-text-faint mt-0.5">
                              <MessageSquare className="h-3 w-3" />
                              {noteCount}
                            </div>
                          )}
                        </div>
                      </div>
                      <MarketShareBar
                        className="mt-2 h-1 relative z-[1]"
                        segments={[
                          {
                            id: "share",
                            value: competitor.salesPotential,
                            colorClass: isSelected
                              ? "bg-neon-purple/60"
                              : "bg-text-faint/40",
                            label: competitor.name,
                          },
                          {
                            id: "rest",
                            value: Math.max(0, totalMarket - competitor.salesPotential),
                            colorClass: "bg-transparent",
                            label: "Rest of market",
                          },
                        ]}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {competitors.length > 0 && (
          <div className="shrink-0 px-3 py-3 border-t border-border-glass bg-bg-secondary/40">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-text-faint">
                  Competitors
                </div>
                <div className="text-xs font-semibold text-text-primary mt-0.5 tabular-nums">
                  {formatCompetitorCurrency(totalCompetitorSales)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-text-faint">Us</div>
                <div className="text-xs font-semibold text-neon-purple-tint mt-0.5 tabular-nums">
                  {formatCompetitorCurrency(ourSales)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-text-faint">Market</div>
                <div className="text-xs font-semibold text-text-primary mt-0.5 tabular-nums">
                  {formatCompetitorCurrency(totalMarket)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex-1 flex-col min-h-0 min-w-0",
          selectedCompetitor ? "flex" : "hidden md:flex",
        )}
      >
        {selectedCompetitor ? (
          <>
            {isMobile && (
              <div className="shrink-0 px-2 py-2 border-b border-border-glass flex items-center">
                <button
                  type="button"
                  onClick={() => onSelectCompetitor(null)}
                  className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover min-h-[44px]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Competitors
                </button>
              </div>
            )}

            <div className="shrink-0 px-4 py-3 border-b border-border-glass">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  {isRenaming ? (
                    <input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => {
                        const raw = renameDraft.trim();
                        setIsRenaming(false);
                        if (!raw || raw === selectedCompetitor.name) return;
                        void onUpdate(selectedCompetitor.id, { name: raw });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setIsRenaming(false);
                      }}
                      autoFocus
                      className="flex-1 min-w-0 bg-bg-secondary border border-neon-purple/30 rounded-lg px-3 py-1.5 text-lg font-semibold focus:outline-none text-text-primary"
                      aria-label="Rename competitor"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openBreakdown(selectedCompetitor.name)}
                        className="flex-1 min-w-0 text-left text-lg font-semibold text-text-primary hover:text-neon-purple-tint transition truncate"
                        title="View workspace-wide competitor breakdown"
                      >
                        {selectedCompetitor.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameDraft(selectedCompetitor.name);
                          setIsRenaming(true);
                        }}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover shrink-0"
                        aria-label="Rename competitor"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRequestDelete(selectedCompetitor.id)}
                  className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
                  aria-label="Delete competitor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Sales potential
                  </span>
                  <div className="relative mt-1.5">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
                    <input
                      defaultValue={formatDollarInput(selectedCompetitor.salesPotential)}
                      key={`sales-${selectedCompetitor.id}-${selectedCompetitor.updatedAt}`}
                      onChange={(e) => {
                        e.target.value = formatDollarInputFromString(e.target.value);
                      }}
                      onBlur={(e) => {
                        const next = parseDollarInput(e.target.value);
                        e.target.value = formatDollarInput(next);
                        if (next !== selectedCompetitor.salesPotential) {
                          void onUpdate(selectedCompetitor.id, { salesPotential: next });
                        }
                      }}
                      inputMode="numeric"
                      placeholder="$0"
                      className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-3 py-2.5 text-sm text-right focus:outline-none focus:border-neon-purple/40 tabular-nums"
                      aria-label="Sales potential"
                    />
                  </div>
                </label>
                <div className="rounded-xl border border-border-glass bg-bg-secondary px-4 py-3">
                  <div className="text-xs text-text-muted">Share of market</div>
                  <div className="text-2xl font-bold text-text-primary mt-0.5 tabular-nums">
                    {formatCompetitorShare(selectedShare)}
                  </div>
                  <div className="text-xs text-text-faint mt-1 tabular-nums">
                    vs our {formatCompetitorShare(marketShare)}
                  </div>
                </div>
              </div>

              <MarketShareBar
                className="mt-3"
                segments={[
                  {
                    id: "our",
                    value: ourSales,
                    colorClass: "bg-neon-purple/70",
                    label: "Our sales",
                  },
                  {
                    id: selectedCompetitor.id,
                    value: selectedCompetitor.salesPotential,
                    colorClass: "bg-amber-400/60",
                    label: selectedCompetitor.name,
                  },
                  {
                    id: "others",
                    value: Math.max(
                      0,
                      totalMarket - ourSales - selectedCompetitor.salesPotential,
                    ),
                    colorClass: "bg-text-faint/30",
                    label: "Other competitors",
                  },
                ].filter((s) => s.value > 0)}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <NotebookProgressTimeline
                entries={competitorNotes}
                members={members}
                currentUserId={currentUserId}
                emptyMessage="No notes for this competitor yet. Capture positioning, pricing intel, or win/loss insights below."
                onUpdateEntry={onUpdateNote}
                onRequestDeleteEntry={onRequestDeleteNote}
              />
            </div>
            <NotebookProgressComposer
              placeholder="Add a competitor note…"
              onSubmit={async (body) => {
                await onAddNote(selectedCompetitor.id, body);
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center p-8 gap-3">
            <div className="rounded-2xl border border-border-glass bg-bg-secondary p-4 max-w-sm">
              <TrendingUp className="h-8 w-8 text-neon-purple-tint mx-auto mb-3 opacity-80" />
              <p className="text-sm font-medium text-text-primary">
                {competitors.length === 0
                  ? "Map your competitive landscape"
                  : "Select a competitor"}
              </p>
              <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
                {competitors.length === 0
                  ? "Enter your sales and add competitors to see market share at a glance."
                  : "Choose a competitor from the list to edit details and add research notes."}
              </p>
              {totalMarket > 0 && competitors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border-glass">
                  <div className="text-2xl font-bold text-neon-purple-tint tabular-nums">
                    {formatCompetitorShare(marketShare)}
                  </div>
                  <p className="text-xs text-text-faint mt-1">Your current market share</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AddCompetitorModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        suggestions={nameSuggestions}
        onAdd={handleAdd}
      />

      <CompetitorBreakdownModal
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        focusCompetitorName={breakdownFocusName}
        competitors={workspaceCompetitors}
        notebooks={notebooks}
        notes={workspaceCompetitorNotes}
        workspaceName={workspaceName}
      />
    </div>
  );
}