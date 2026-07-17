"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { cn } from "@/lib/utils";
import type { NotebookInvestment, NotebookInvestmentNote, WorkspaceMember } from "@/types";
import { NotebookProgressComposer } from "./NotebookProgressComposer";
import { NotebookProgressTimeline } from "./NotebookProgressTimeline";

interface NotebookInvestmentsPanelProps {
  investments: NotebookInvestment[];
  notes: NotebookInvestmentNote[];
  members: WorkspaceMember[];
  currentUserId?: string;
  selectedInvestmentId: string | null;
  onSelectInvestment: (id: string | null) => void;
  onAdd: (title?: string) => void | Promise<unknown>;
  onToggle: (id: string) => void | Promise<unknown>;
  onUpdate: (id: string, title: string) => void | Promise<unknown>;
  onReorder: (orderedIds: string[]) => void | Promise<unknown>;
  onRequestDelete: (id: string) => void;
  onAddNote: (investmentId: string, body: string) => void | Promise<unknown>;
  onUpdateNote: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteNote: (id: string) => void;
}

export function NotebookInvestmentsPanel({
  investments,
  notes,
  members,
  currentUserId,
  selectedInvestmentId,
  onSelectInvestment,
  onAdd,
  onToggle,
  onUpdate,
  onReorder,
  onRequestDelete,
  onAddNote,
  onUpdateNote,
  onRequestDeleteNote,
}: NotebookInvestmentsPanelProps) {
  const isMobile = useIsMobileViewport();
  const [newTitle, setNewTitle] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const openInvestments = useMemo(
    () => investments.filter((i) => !i.completed),
    [investments],
  );
  const completedInvestments = useMemo(
    () => investments.filter((i) => i.completed),
    [investments],
  );
  const completedCount = completedInvestments.length;

  const visibleInvestments = useMemo(() => {
    if (!showCompleted) return openInvestments;
    return [...openInvestments, ...completedInvestments];
  }, [showCompleted, openInvestments, completedInvestments]);

  const selectedInvestment = useMemo(
    () => investments.find((i) => i.id === selectedInvestmentId) ?? null,
    [investments, selectedInvestmentId],
  );

  const investmentNotes = useMemo(
    () =>
      selectedInvestmentId
        ? notes.filter((n) => n.investmentId === selectedInvestmentId)
        : [],
    [notes, selectedInvestmentId],
  );

  useEffect(() => {
    if (completedCount === 0 && showCompleted) setShowCompleted(false);
  }, [completedCount, showCompleted]);

  useEffect(() => {
    if (!selectedInvestmentId) return;
    const stillExists = investments.some((i) => i.id === selectedInvestmentId);
    if (!stillExists) {
      onSelectInvestment(null);
      return;
    }
    if (!showCompleted) {
      const selected = investments.find((i) => i.id === selectedInvestmentId);
      if (selected?.completed) onSelectInvestment(null);
    }
  }, [investments, selectedInvestmentId, showCompleted, onSelectInvestment]);

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    void onAdd(title);
    setNewTitle("");
  };

  const handleToggle = async (item: NotebookInvestment) => {
    const completing = !item.completed;
    await onToggle(item.id);
    if (completing) {
      toast.success("Investment completed", { description: item.title });
      if (!showCompleted && selectedInvestmentId === item.id) onSelectInvestment(null);
    } else {
      toast.success("Investment reopened", { description: item.title });
    }
  };

  const move = (visibleIndex: number, direction: "up" | "down") => {
    const item = visibleInvestments[visibleIndex];
    if (!item || item.completed) return;
    const openIndex = openInvestments.findIndex((i) => i.id === item.id);
    if (openIndex < 0) return;
    const nextIndex = direction === "up" ? openIndex - 1 : openIndex + 1;
    if (nextIndex < 0 || nextIndex >= openInvestments.length) return;
    const ordered = openInvestments.map((i) => i.id);
    [ordered[openIndex], ordered[nextIndex]] = [ordered[nextIndex], ordered[openIndex]];
    // Keep completed items after open ones in persisted order
    void onReorder([...ordered, ...completedInvestments.map((i) => i.id)]);
  };

  const showMobileDetail = isMobile && !!selectedInvestment;

  return (
    <div className="notebooks-section-panel flex flex-1 min-h-0 min-w-0">
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 shrink-0 flex flex-col min-h-0 border-r border-border-glass bg-bg",
          showMobileDetail && "hidden",
        )}
      >
        <div className="shrink-0 p-3 border-b border-border-glass space-y-2">
          <p className="text-xs text-text-muted px-0.5">
            Rank investments by priority — highest at the top.
          </p>
          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="Add investment…"
              className="flex-1 min-w-0 bg-bg-secondary border border-border-glass rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newTitle.trim()}
              className="shrink-0 flex items-center justify-center rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-3 py-2 text-sm font-medium text-neon-purple-tint disabled:opacity-40 min-h-[40px]"
              aria-label="Add investment"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {completedCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className={cn(
                "inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                showCompleted
                  ? "border-neon-purple/40 bg-neon-purple/12 text-neon-purple-tint"
                  : "border-border-glass bg-surface-hover/60 text-text-secondary hover:text-text-primary hover:border-neon-purple/30",
              )}
              aria-pressed={showCompleted}
              aria-label={
                showCompleted
                  ? "Hide completed investments"
                  : `Show ${completedCount} completed investment${completedCount === 1 ? "" : "s"}`
              }
            >
              {showCompleted ? (
                <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <Check className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span>
                {showCompleted
                  ? "Hide completed"
                  : `View ${completedCount} completed`}
              </span>
            </button>
          ) : null}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {investments.length === 0 ? (
            <p className="text-sm text-text-muted px-4 py-6 text-center">No investments yet.</p>
          ) : visibleInvestments.length === 0 ? (
            <p className="text-sm text-text-muted px-4 py-6 text-center">
              All caught up. View completed above if you need them.
            </p>
          ) : (
            <ul className="py-1">
              {visibleInvestments.map((item, index) => {
                const isSelected = selectedInvestmentId === item.id;
                const openRank = openInvestments.findIndex((i) => i.id === item.id);
                const isCompleted = !!item.completed;
                return (
                  <li key={item.id}>
                    <div
                      className={cn(
                        "files-list-item flex items-center gap-1 px-2 py-2 transition relative",
                        isSelected && "files-list-item--selected",
                        !isSelected && "hover:bg-surface-hover",
                      )}
                      aria-selected={isSelected}
                    >
                      <GripVertical
                        className="h-4 w-4 text-text-faint shrink-0 relative z-[1]"
                        aria-hidden
                      />
                      <span className="text-xs font-semibold text-text-faint w-5 shrink-0 text-center relative z-[1]">
                        {isCompleted ? "✓" : openRank + 1}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggle(item);
                        }}
                        className={cn(
                          "shrink-0 relative z-[1] h-5 w-5 rounded border flex items-center justify-center transition bg-bg",
                          isCompleted
                            ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-400"
                            : isSelected
                              ? "border-neon-purple/55 text-transparent"
                              : "border-border-glass text-transparent hover:border-neon-purple/40",
                        )}
                        aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectInvestment(item.id)}
                        className={cn(
                          "flex-1 min-w-0 text-left text-sm font-medium truncate px-1 py-1 relative z-[1]",
                          isCompleted ? "line-through text-text-muted" : "text-text-primary",
                        )}
                      >
                        {item.title}
                      </button>
                      {!isCompleted ? (
                        <div className="flex items-center gap-0.5 shrink-0 relative z-[1]">
                          <button
                            type="button"
                            onClick={() => move(index, "up")}
                            disabled={openRank <= 0}
                            className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover disabled:opacity-30"
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(index, "down")}
                            disabled={openRank < 0 || openRank >= openInvestments.length - 1}
                            className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover disabled:opacity-30"
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex-1 flex-col min-h-0 min-w-0",
          selectedInvestment ? "flex" : "hidden md:flex",
        )}
      >
        {selectedInvestment ? (
          <>
            {isMobile && (
              <div className="shrink-0 px-2 py-2 border-b border-border-glass flex items-center">
                <button
                  type="button"
                  onClick={() => onSelectInvestment(null)}
                  className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover min-h-[44px]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Investments
                </button>
              </div>
            )}
            <div className="shrink-0 px-4 py-3 border-b border-border-glass flex items-center gap-2">
              <input
                defaultValue={selectedInvestment.title}
                key={selectedInvestment.id}
                onBlur={(e) => {
                  const next = e.target.value.trim() || selectedInvestment.title;
                  if (!e.target.value.trim()) e.target.value = selectedInvestment.title;
                  if (next !== selectedInvestment.title) void onUpdate(selectedInvestment.id, next);
                }}
                className="flex-1 min-w-0 bg-transparent text-lg font-semibold focus:outline-none text-text-primary"
                aria-label="Investment title"
              />
              <button
                type="button"
                onClick={() => onRequestDelete(selectedInvestment.id)}
                className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
                aria-label="Delete investment"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <NotebookProgressTimeline
                entries={investmentNotes}
                members={members}
                currentUserId={currentUserId}
                emptyMessage="No notes for this investment yet."
                onUpdateEntry={onUpdateNote}
                onRequestDeleteEntry={onRequestDeleteNote}
              />
            </div>
            <NotebookProgressComposer
              placeholder="Add an investment note…"
              onSubmit={async (body) => {
                await onAddNote(selectedInvestment.id, body);
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-text-muted p-8 text-center">
            Select an investment to view and add notes.
          </div>
        )}
      </div>
    </div>
  );
}
