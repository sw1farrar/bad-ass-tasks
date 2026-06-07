"use client";

import React from "react";
import { Network, Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getHybridSearchResults } from "@/lib/utils";

interface TasksSearchProps {
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  searchResultType: "all" | "task" | "note";
  setSearchResultType: (t: "all" | "task" | "note") => void;
  taskFilter: any;
  setTaskFilter: (f: any) => void;
  setIsGraphOpen: (open: boolean) => void;
  setGraphFocusId: (id: string | null) => void;
  tasks: any[];
  notes: any[];
  setView: (view: any) => void;
  selectTask: (id: string) => void;
  setShowFullTaskModal: (open: boolean) => void;
  setSelectedNoteId: (id: string | null) => void;
}

/**
 * TasksSearch
 *
 * Extracted from the monolithic app/page.tsx as part of M0 architecture resumption (Batch 2.5).
 *
 * Contains the hybrid semantic search input, type filters, recurring filters, Clear button,
 * and the live semantic results cards (when query is active).
 *
 * Guard note: The actual data (tasks/notes) and all store mutations/selection logic
 * are passed in as props. No direct store access or guarded hybrid calls happen here
 * beyond the safe utility `getHybridSearchResults`. All heavy invariants remain in parent.
 */
export function TasksSearch({
  globalSearchQuery,
  setGlobalSearchQuery,
  searchResultType,
  setSearchResultType,
  taskFilter,
  setTaskFilter,
  setIsGraphOpen,
  setGraphFocusId,
  tasks,
  notes,
  setView,
  selectTask,
  setShowFullTaskModal,
  setSelectedNoteId,
}: TasksSearchProps) {
  return (
    <>
      {/* Agent 32: Upgraded hybrid semantic global search + filters */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex gap-2 items-center">
          <input
            value={globalSearchQuery}
            onChange={(e) => {
              setGlobalSearchQuery(e.target.value);
              setTaskFilter({ search: e.target.value });
            }}
            placeholder="Search tasks and notes…"
            className="input flex-1 px-3 py-2 md:py-2.5 rounded-2xl text-sm"
          />
          <button
            onClick={() => setIsGraphOpen(true)}
            className="btn btn-secondary px-2.5 py-2 text-xs md:text-sm flex items-center gap-1 border-[#c084fc]/40 hover:border-[#c084fc]"
            title="Knowledge Graph"
          >
            <Network className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Graph</span>
          </button>
        </div>

        {/* Compact mobile-first filter bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 text-[10px] snap-x touch-pan-x">
          {(['all', 'task', 'note'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSearchResultType(t)}
              className={cn(
                "px-2.5 py-1 rounded-full border transition snap-start shrink-0",
                searchResultType === t ? "bg-[#c084fc] text-black border-[#c084fc]" : "border-white/10 hover:bg-white/5 text-[#a1a1aa]"
              )}
            >
              {t === 'all' ? 'All' : t === 'task' ? 'Tasks' : 'Notes'}
            </button>
          ))}
          <button
            onClick={() => {
              setGlobalSearchQuery("");
              setTaskFilter({ search: "" });
              setSearchResultType('all');
            }}
            className="px-2 py-1 text-[#71717a] hover:text-white shrink-0"
          >
            Clear
          </button>

          {/* Recurring filters */}
          {(["all", "only", "none"] as const).map((mode) => (
            <button
              key={`rec-${mode}`}
              onClick={() => setTaskFilter({ recurring: mode === "all" ? undefined : mode })}
              className={cn(
                "px-2 py-1 rounded-full border transition snap-start shrink-0",
                (mode === "all" && !taskFilter.recurring) || taskFilter.recurring === mode
                  ? "bg-[#c084fc] text-black border-[#c084fc]"
                  : "border-white/10 hover:bg-white/5 text-[#a1a1aa]"
              )}
            >
              {mode === "all" ? "All tasks" : mode === "only" ? "Recurring" : "Non-recurring"}
            </button>
          ))}
        </div>
      </div>

      {/* Live hybrid semantic results */}
      {globalSearchQuery.trim().length > 1 && (() => {
        const hybrid = getHybridSearchResults(globalSearchQuery, { tasks, notes }, {
          types: searchResultType === 'all' ? ['task', 'note'] : [searchResultType],
          limit: 12,
        });
        if (hybrid.length === 0) return null;
        return (
          <div className="mb-4 glass rounded-2xl p-3 border border-[#c084fc]/20">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-xs font-semibold tracking-widest text-[#c084fc]">
                SEMANTIC RESULTS • {hybrid.length} matches
              </div>
              <button
                onClick={() => setIsGraphOpen(true)}
                className="text-[10px] text-[#c084fc] hover:underline flex items-center gap-1"
              >
                View in Graph <Network className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {hybrid.map((r) => (
                <div
                  key={r.id}
                  onClick={() => {
                    if (r.type === 'task') {
                      setView("tasks");
                      selectTask(r.id);
                      setShowFullTaskModal(true);
                    } else {
                      setView("notes");
                      setSelectedNoteId(r.id);
                    }
                  }}
                  className="group p-2.5 rounded-xl border border-white/10 hover:border-[#c084fc]/40 bg-white/5 cursor-pointer flex gap-2 text-sm"
                >
                  <div className="mt-0.5">
                    {r.type === 'task' ? <Check className="h-4 w-4 text-[#c084fc]" /> : <Star className="h-4 w-4 text-[#00ff9f]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate group-hover:text-[#c084fc]">{r.title}</div>
                    <div className="text-[10px] text-[#71717a] truncate">{r.snippet}</div>
                    <div className="text-[9px] mt-0.5 text-[#c084fc]/70 font-mono">
                      {r.score}% • {r.reasons.join(' ')}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsGraphOpen(true);
                      setGraphFocusId(r.id);
                    }}
                    className="self-start text-[9px] px-1.5 py-0.5 rounded bg-white/10 opacity-60 group-hover:opacity-100"
                  >
                    Graph
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </>
  );
}
