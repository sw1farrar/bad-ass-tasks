"use client";

import React, { useState } from "react";
import {
  Settings,
  BarChart3,
  FileDown,
  Upload,
  FileText,
  Users,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useTaskStore } from "@/store/useTaskStore";
import { ActivityLog, Note, Task, WorkspaceMember } from "@/types";
import { isDueDatePast } from "@/lib/datetime";

type AdminTab = "overview" | "exports" | "imports" | "templates" | "insights";

export interface TeamsAdminInsights {
  totalActivity: number;
  adminActions?: number;
  topContributors?: Array<[string, number]>;
  overdueCount: number;
  overdueByPriority?: Record<string, number>;
  lastAnalyzed: string;
}

export interface TeamsAdminDashboardProps {
  currentWorkspace: { id: string; name: string };
  myRole: string;
  isSingleOwnerWorkspace: boolean;
  isLiveWorkspace: boolean;
  tasks: Task[];
  notes: Note[];
  members: WorkspaceMember[];
  recentActivity: ActivityLog[];
  onOpenWorkspaceSettings: () => void;
  canEditWorkspaceDetails?: boolean;
}

export function TeamsAdminDashboard({
  currentWorkspace,
  myRole,
  isSingleOwnerWorkspace,
  isLiveWorkspace,
  tasks,
  notes,
  members,
  recentActivity,
  onOpenWorkspaceSettings,
  canEditWorkspaceDetails = false,
}: TeamsAdminDashboardProps) {
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const [importStrategy, setImportStrategy] = useState<"append" | "skip-dupe-titles">(
    "skip-dupe-titles"
  );
  const [importPreview, setImportPreview] = useState<{
    tasks: number;
    notes: number;
    source: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [insights, setInsights] = useState<TeamsAdminInsights | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  const liveBlocked = !isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id);

  const loadInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const hybrid = await import("@/lib/data/hybridStore");
      const fullActivity = await hybrid.getRecentActivity(currentWorkspace.id, 500);
      const contribMap: Record<string, number> = {};
      fullActivity.forEach((a: ActivityLog) => {
        const key = a.userId || "unknown";
        contribMap[key] = (contribMap[key] || 0) + 1;
      });
      const topContribs = Object.entries(contribMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const adminActions = fullActivity.filter((a) =>
        (a.actionType || "").startsWith("admin.")
      ).length;
      const overdueNow = tasks.filter(
        (t) => t.dueDate && isDueDatePast(t.dueDate) && t.status !== "done"
      );
      const overdueByPrio: Record<string, number> = {};
      overdueNow.forEach((t) => {
        overdueByPrio[t.priority] = (overdueByPrio[t.priority] || 0) + 1;
      });
      setInsights({
        totalActivity: fullActivity.length,
        adminActions,
        topContributors: topContribs,
        overdueCount: overdueNow.length,
        overdueByPriority: overdueByPrio,
        lastAnalyzed: new Date().toLocaleTimeString(),
      });
      toast.success("Deep insights loaded");
    } catch {
      const contribMap: Record<string, number> = {};
      recentActivity.forEach((a) => {
        const k = a.userId || "anon";
        contribMap[k] = (contribMap[k] || 0) + 1;
      });
      setInsights({
        totalActivity: recentActivity.length,
        topContributors: Object.entries(contribMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        overdueCount: tasks.filter(
          (t) => t.dueDate && isDueDatePast(t.dueDate) && t.status !== "done"
        ).length,
        lastAnalyzed: "local (limited)",
      });
    } finally {
      setIsLoadingInsights(false);
    }
  };

  return (
    <div className="glass rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 bg-white/5">
        <div className="font-semibold flex items-center gap-2 text-lg tracking-tight mb-1">
          <BarChart3 className="h-5 w-5 text-[#c084fc]" /> Data &amp; admin tools
        </div>
        <p className="text-[11px] text-[#71717a] mb-3">
          Export, import, templates, and workspace insights for your team.
        </p>

        <div className="flex gap-1 text-xs overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory touch-pan-x">
          {(
            [
              { id: "overview" as const, label: "Overview", icon: BarChart3 },
              { id: "exports" as const, label: "Export", icon: FileDown },
              { id: "imports" as const, label: "Import", icon: Upload },
              { id: "templates" as const, label: "Templates", icon: FileText },
              { id: "insights" as const, label: "Insights", icon: Users },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = adminTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] snap-start rounded-xl border transition-all shrink-0 ${
                  active
                    ? "bg-[#c084fc] text-black border-[#c084fc] font-medium"
                    : "bg-white/5 border-white/10 hover:bg-white/10 text-[#a1a1aa] hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {adminTab === "overview" && (
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-[#71717a] text-xs flex items-center gap-1">
                Tasks <span className="text-emerald-400">•</span> Done
              </div>
              <div className="text-2xl font-semibold tabular-nums mt-1">
                {tasks.length}{" "}
                <span className="text-xs text-[#a1a1aa]">
                  / {tasks.filter((t) => t.status === "done").length}
                </span>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-[#71717a] text-xs">Notes • Team Size</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">
                {notes.length}{" "}
                <span className="text-xs text-[#a1a1aa]">/ {members.length}</span>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-[#71717a] text-xs">Overdue • Completion</div>
              <div className="text-2xl font-semibold tabular-nums mt-1 text-[#ff3366]">
                {
                  tasks.filter(
                    (t) =>
                      t.dueDate &&
                      isDueDatePast(t.dueDate) &&
                      t.status !== "done"
                  ).length
                }{" "}
                <span className="text-xs text-[#a1a1aa]">
                  / ~
                  {Math.round(
                    (tasks.filter((t) => t.status === "done").length /
                      Math.max(1, tasks.length)) *
                      100
                  )}
                  %
                </span>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-[#71717a] text-xs">Activity</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">
                {recentActivity.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {adminTab === "exports" && (
        <div className="p-5 border-t border-white/10">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => useTaskStore.getState().exportWorkspace("json")}
              disabled={liveBlocked}
              className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" /> JSON
            </button>
            <button
              onClick={() => useTaskStore.getState().exportWorkspace("csv")}
              disabled={liveBlocked}
              className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" /> CSV
            </button>
            <button
              onClick={() => useTaskStore.getState().exportWorkspace("md")}
              disabled={liveBlocked}
              className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" /> Markdown
            </button>
            <button
              onClick={() => useTaskStore.getState().exportWorkspace("all")}
              disabled={liveBlocked}
              className="btn btn-primary text-xs px-4 py-2 flex items-center gap-2 bg-[#c084fc] text-black hover:bg-[#a855f7]"
            >
              <Download className="h-4 w-4" /> All
            </button>
          </div>
        </div>
      )}

      {adminTab === "imports" && (
        <div className="p-5 border-t border-white/10 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div>
              <div className="flex gap-2 text-xs">
                <label
                  className={`px-3 py-1 rounded-xl border cursor-pointer ${
                    importStrategy === "skip-dupe-titles"
                      ? "border-[#c084fc] bg-white/10"
                      : "border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    className="hidden"
                    checked={importStrategy === "skip-dupe-titles"}
                    onChange={() => setImportStrategy("skip-dupe-titles")}
                  />{" "}
                  Skip duplicates
                </label>
                <label
                  className={`px-3 py-1 rounded-xl border cursor-pointer ${
                    importStrategy === "append"
                      ? "border-[#c084fc] bg-white/10"
                      : "border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    className="hidden"
                    checked={importStrategy === "append"}
                    onChange={() => setImportStrategy("append")}
                  />{" "}
                  Append all
                </label>
              </div>
            </div>
            <label className="btn btn-secondary text-xs px-4 py-2 cursor-pointer inline-flex items-center gap-2 mt-4">
              <Upload className="h-4 w-4" /> Choose file
              <input
                type="file"
                accept=".json,.csv,.md,.txt"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || liveBlocked) return;
                  setImportPreview(null);
                  const text = await file.text();
                  const ext = file.name.split(".").pop()?.toLowerCase() || "";
                  let parsed: { tasks?: unknown[]; notes?: unknown[] } = { tasks: [], notes: [] };
                  try {
                    const utilsMod = await import("@/lib/utils");
                    if (ext === "json") {
                      parsed = utilsMod.parseJSONImport(text);
                    } else if (ext === "csv") {
                      parsed = { tasks: utilsMod.parseCSVToTasks(text) };
                    } else {
                      const taskLines = text
                        .split("\n")
                        .filter((l) => l.match(/^\s*-\s*\[[\sx]\]/i));
                      parsed.tasks = taskLines.map((l) => ({
                        title: l.replace(/^\s*-\s*\[[\sx]\]\s*/, "").trim().slice(0, 140),
                      }));
                      const noteMatches = text.match(/^###\s+(.+)$/gm) || [];
                      parsed.notes = noteMatches.slice(0, 20).map((h: string) => ({
                        title: h.replace(/^###\s+/, "").trim(),
                      }));
                    }
                    setImportPreview({
                      tasks: parsed.tasks?.length || 0,
                      notes: parsed.notes?.length || 0,
                      source: file.name,
                    });
                    (window as Window & { __pendingImport?: unknown }).__pendingImport = parsed;
                  } catch {
                    toast.error("Failed to parse file");
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {importPreview && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs">
              <div>
                Preview from <span className="font-mono">{importPreview.source}</span>:
              </div>
              <div className="font-medium mt-1">
                {importPreview.tasks} tasks • {importPreview.notes} notes ready to import.
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  disabled={isImporting || liveBlocked}
                  onClick={async () => {
                    const parsed = (window as Window & { __pendingImport?: { tasks?: unknown[]; notes?: unknown[] } })
                      .__pendingImport;
                    if (!parsed) return;
                    setIsImporting(true);
                    try {
                      const res = await useTaskStore
                        .getState()
                        .importWorkspaceData(parsed, { conflictStrategy: importStrategy });
                      toast.success(
                        `Import complete: ${res.importedTasks} tasks, ${res.importedNotes} notes${
                          res.skippedTasks || res.skippedNotes
                            ? ` (skipped ${res.skippedTasks || 0} tasks, ${res.skippedNotes || 0} notes)`
                            : ""
                        }`
                      );
                      await useTaskStore.getState().initializeFromSupabase?.();
                      setImportPreview(null);
                      (window as Window & { __pendingImport?: unknown }).__pendingImport = null;
                    } catch {
                      toast.error("Import failed");
                    } finally {
                      setIsImporting(false);
                    }
                  }}
                  className="btn btn-primary text-xs px-3 py-1"
                >
                  {isImporting
                    ? "Importing..."
                    : `Import with ${importStrategy === "skip-dupe-titles" ? "Smart Skip" : "Append"}`}
                </button>
                <button
                  onClick={() => {
                    setImportPreview(null);
                    (window as Window & { __pendingImport?: unknown }).__pendingImport = null;
                  }}
                  className="btn btn-ghost text-xs px-3 py-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {adminTab === "templates" && (
        <div className="p-5 border-t border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {(useTaskStore.getState().getAdminTemplateLibrary?.() || []).map(
              (tpl: { title: string; type: string; description?: string; tags?: string[] }, idx: number) => (
                <div
                  key={idx}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-[#c084fc]/40 transition group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-1.5">
                        {tpl.title}
                        <span
                          className={`text-[9px] px-1 rounded ${
                            tpl.type === "note"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {tpl.type}
                        </span>
                      </div>
                      {tpl.description && (
                        <div className="text-[10px] text-[#a1a1aa] line-clamp-2 mt-0.5 pr-2">
                          {tpl.description.slice(0, 110)}
                          {tpl.description.length > 110 ? "…" : ""}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        const res = await useTaskStore.getState().applyTemplate(tpl);
                        if (res) toast.success(`Applied: ${tpl.title}`);
                        else toast.info("Template applied (demo or error — check tasks/notes)");
                      }}
                      className="opacity-70 group-hover:opacity-100 text-[#c084fc] hover:text-white text-[10px] px-2 py-0.5 border border-white/20 rounded hover:bg-[#c084fc]/10 self-start"
                      disabled={liveBlocked}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {adminTab === "insights" && (
        <div className="p-5 border-t border-white/10 space-y-4 text-sm">
          <div className="flex items-center justify-end">
            <button
              onClick={loadInsights}
              disabled={isLoadingInsights}
              className="btn btn-ghost text-xs px-3 py-1 flex gap-1"
            >
              <BarChart3 className="h-3.5 w-3.5" />{" "}
              {isLoadingInsights ? "Loading..." : "Refresh"}
            </button>
          </div>
          {insights ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-xs text-[#71717a] mb-1">Activity & Admin Volume</div>
                <div className="text-xl font-semibold">
                  {insights.totalActivity} total events • {insights.adminActions || 0} admin actions
                </div>
                <div className="text-[10px] mt-1 text-[#a1a1aa]">
                  Last analyzed: {insights.lastAnalyzed}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="text-xs text-[#71717a] mb-1">Overdue Trends</div>
                <div className="text-xl font-semibold text-[#ff3366]">
                  {insights.overdueCount} overdue now
                </div>
                <div className="text-xs mt-1">
                  By priority:{" "}
                  {Object.entries(insights.overdueByPriority || {})
                    .map(([p, c]) => `${p}:${c}`)
                    .join("  ") || "—"}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10 md:col-span-2">
                <div className="text-xs text-[#71717a] mb-1.5">Top contributors</div>
                {insights.topContributors?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {insights.topContributors.map(([user, count], i) => (
                      <div key={i} className="px-2 py-0.5 bg-white/10 rounded text-xs font-mono">
                        {user.slice(0, 12)}: <span className="text-[#c084fc]">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[#71717a]">No data</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02] flex justify-end">
        <button
          onClick={onOpenWorkspaceSettings}
          className="text-xs text-[#c084fc] hover:underline flex items-center gap-1"
        >
          {canEditWorkspaceDetails ? "Workspace settings" : "Notification settings"} <Settings className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}