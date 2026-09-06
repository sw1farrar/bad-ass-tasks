"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Check, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { apiFetch } from "@/lib/api/apiFetch";
import { IMPORT_CHUNK_MAX } from "@/lib/import/importChunk";
import { cn, generateId } from "@/lib/utils";
import { generateClientId, getTaskFolders as fetchWorkspaceFolders, isSupabaseLive } from "@/lib/data/hybridStore";
import { useTaskStore } from "@/store/useTaskStore";
import { parseToodledoCsv } from "@/features/import/platforms/toodledo";
import type { ImportKind, ToodledoImportPreview } from "@/features/import/types";
import type { Task } from "@/types";
import "../import.css";

const PLATFORMS = [
  { id: "toodledo", label: "Toodledo", available: true, hint: "CSV export of current and completed tasks" },
  { id: "todoist", label: "Todoist", available: false, hint: "Coming soon" },
  { id: "apple_reminders", label: "Apple Reminders", available: false, hint: "Coming soon" },
] as const;

type WizardStep = "platform" | "files" | "preview" | "importing";

interface ImportWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (pendingReview: number) => void;
}

function FileDrop({
  label,
  hint,
  file,
  onFile,
}: {
  label: string;
  hint: string;
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  const [over, setOver] = useState(false);
  const takeFile = (next: File | null | undefined) => {
    if (!next) return;
    if (!/\.csv$/i.test(next.name) && next.type && !next.type.includes("csv")) {
      toast.error("Use a Toodledo CSV export");
      return;
    }
    onFile(next);
  };
  return (
    <label
      className={cn(
        "flex flex-col gap-1 rounded-2xl border border-dashed px-4 py-4 cursor-pointer transition",
        over
          ? "border-neon-purple bg-neon-purple/10"
          : "border-border-glass bg-surface-hover/40 hover:border-neon-purple/40",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        takeFile(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <span className="text-[11px] text-text-muted">{hint}</span>
      <span className="mt-2 inline-flex items-center gap-2 text-xs text-neon-purple">
        <Upload className="h-3.5 w-3.5" />
        {file ? file.name : "Drop a CSV or choose a file"}
      </span>
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => takeFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export function ImportWizardModal({ open, onOpenChange, onImported }: ImportWizardModalProps) {
  const workspaceId = useTaskStore((s) => s.currentWorkspace.id);
  const role = useTaskStore((s) => s.currentWorkspace.role);
  const addTaskFolder = useTaskStore((s) => s.addTaskFolder);
  const mergeImportedTasks = useTaskStore((s) => s.mergeImportedTasks);
  const getTaskFolders = useTaskStore((s) => s.getTaskFolders);
  const fetchCompletedTasks = useTaskStore((s) => s.fetchCompletedTasks);

  const [step, setStep] = useState<WizardStep>("platform");
  const [platform, setPlatform] = useState<"toodledo" | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [completedFile, setCompletedFile] = useState<File | null>(null);
  const [currentPreview, setCurrentPreview] = useState<ToodledoImportPreview | null>(null);
  const [completedPreview, setCompletedPreview] = useState<ToodledoImportPreview | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [busy, setBusy] = useState(false);

  const canImport = role === "owner" || role === "admin";

  const reset = useCallback(() => {
    setStep("platform");
    setPlatform(null);
    setCurrentFile(null);
    setCompletedFile(null);
    setCurrentPreview(null);
    setCompletedPreview(null);
    setProgress({ done: 0, total: 0, label: "" });
    setBusy(false);
  }, []);

  const close = () => {
    if (busy) return;
    onOpenChange(false);
    reset();
  };

  const parseFile = async (file: File, hint?: ImportKind) => {
    const text = await file.text();
    return parseToodledoCsv(text, hint);
  };

  const goPreview = async () => {
    if (!currentFile && !completedFile) {
      toast.error("Add at least one Toodledo CSV");
      return;
    }
    setBusy(true);
    try {
      const parsed: ToodledoImportPreview[] = [];
      if (currentFile) parsed.push(await parseFile(currentFile));
      if (completedFile) parsed.push(await parseFile(completedFile));
      const currents = parsed.filter((p) => p.kind === "current");
      const dones = parsed.filter((p) => p.kind === "completed");
      if (currents.length > 1) {
        toast.info("Using the first open-tasks file", {
          description: "A second file also looked like current tasks.",
        });
      }
      if (dones.length > 1) {
        toast.info("Using the first completed file", {
          description: "A second file also looked like completed history.",
        });
      }
      setCurrentPreview(currents[0] ?? null);
      setCompletedPreview(dones[0] ?? null);
      setStep("preview");
    } catch (err) {
      console.error(err);
      toast.error("Could not parse CSV");
    } finally {
      setBusy(false);
    }
  };

  const mappedToLocalTasks = (preview: ToodledoImportPreview): Task[] => {
    const folders = getTaskFolders();
    const folderByName = new Map(folders.map((f) => [f.name.toLowerCase(), f.id]));
    return preview.tasks.map((row) => ({
      id: generateClientId(),
      workspaceId,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueDate: row.dueDate,
      completedAt: row.completedAt,
      tags: row.tags,
      createdAt: new Date().toISOString(),
      linkedNoteIds: [],
      recurringRule: row.recurringRule,
      starred: row.starred,
      folderId: row.folderName ? folderByName.get(row.folderName.toLowerCase()) ?? null : null,
      timeEstimate: row.timeEstimate,
      importStatus: preview.kind === "current" ? "pending_review" : null,
      importSource: "toodledo",
      importFingerprint: row.fingerprint,
    }));
  };

  const importPreview = async (preview: ToodledoImportPreview, filename: string, batchId?: string) => {
    if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) {
      const folderNames = preview.folderNames;
      for (const name of folderNames) {
        const exists = getTaskFolders().some((f) => f.name.toLowerCase() === name.toLowerCase());
        if (!exists) await addTaskFolder(name);
      }
      if (preview.kind === "current") mergeImportedTasks(mappedToLocalTasks(preview));
      return { batchId: batchId ?? generateId(), inserted: preview.rowCount, pendingReview: preview.kind === "current" ? preview.rowCount : 0 };
    }

    let nextBatch = batchId ?? null;
    const rows = preview.tasks;
    let inserted = 0;
    let pendingReview = 0;
    for (let i = 0; i < rows.length; i += IMPORT_CHUNK_MAX) {
      const chunk = rows.slice(i, i + IMPORT_CHUNK_MAX);
      setProgress({
        done: i,
        total: rows.length,
        label: preview.kind === "current" ? "Importing open tasks" : "Importing completed history",
      });
      const res = await apiFetch("/api/workspace/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          source: "toodledo",
          kind: preview.kind,
          batchId: nextBatch,
          filename,
          rows: chunk,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        batchId?: string;
        inserted?: number;
        pendingReview?: number;
        tasks?: Task[];
      };
      if (!res.ok) throw new Error(json.error || "Import failed");
      nextBatch = json.batchId ?? nextBatch;
      inserted += json.inserted ?? 0;
      pendingReview += json.pendingReview ?? 0;
      if (preview.kind === "current" && json.tasks?.length) mergeImportedTasks(json.tasks);
      setProgress({
        done: Math.min(rows.length, i + chunk.length),
        total: rows.length,
        label: preview.kind === "current" ? "Importing open tasks" : "Importing completed history",
      });
    }
    return { batchId: nextBatch, inserted, pendingReview };
  };

  const runImport = async () => {
    const openCount = currentPreview?.rowCount ?? 0;
    const doneCount = completedPreview?.rowCount ?? 0;
    if (openCount === 0 && doneCount === 0) {
      toast.error("Nothing to import", { description: "Those files had no tasks." });
      return;
    }
    setBusy(true);
    setStep("importing");
    try {
      const live = isSupabaseLive() && !["w1", "w2"].includes(workspaceId);
      if (!live) {
        const folderNames = [
          ...new Set([...(currentPreview?.folderNames ?? []), ...(completedPreview?.folderNames ?? [])]),
        ];
        for (const name of folderNames) {
          const exists = getTaskFolders().some((f) => f.name.toLowerCase() === name.toLowerCase());
          if (!exists) await addTaskFolder(name);
        }
      }

      let pending = 0;
      let batchId: string | undefined;
      if (currentPreview && currentPreview.rowCount > 0) {
        const res = await importPreview(currentPreview, currentFile?.name ?? "current.csv", batchId);
        batchId = res.batchId ?? batchId;
        pending += res.pendingReview;
      }
      if (completedPreview && completedPreview.rowCount > 0) {
        await importPreview(completedPreview, completedFile?.name ?? "completed.csv", batchId);
        if (live) await fetchCompletedTasks({ reset: true });
      }
      if (live) {
        const folders = await fetchWorkspaceFolders(workspaceId);
        if (folders.length) {
          useTaskStore.setState((state) => ({
            taskFolders: [
              ...state.taskFolders.filter((f) => f.workspaceId !== workspaceId),
              ...folders,
            ],
          }));
        }
      }
      toast.success(
        pending > 0
          ? `Imported. Review ${pending} open task${pending === 1 ? "" : "s"}.`
          : "Completed history imported.",
      );
      onImported?.(pending);
      onOpenChange(false);
      reset();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    } finally {
      setBusy(false);
    }
  };

  const unmapped = useMemo(
    () => [...(currentPreview?.unmappedRepeats ?? []), ...(completedPreview?.unmappedRepeats ?? [])],
    [currentPreview, completedPreview],
  );

  if (!canImport) return null;

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title="Import tasks"
      desktopMaxWidth="max-w-lg"
      zIndex={300}
    >
      <div className="flex flex-col gap-4 px-1 pb-4">
        {step === "platform" ? (
          <>
            <p className="text-sm text-text-muted">Choose where these tasks are coming from.</p>
            <div className="grid gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!p.available}
                  onClick={() => {
                    if (!p.available) return;
                    setPlatform("toodledo");
                    setStep("files");
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    p.available
                      ? "border-border-glass hover:border-neon-purple/40 hover:bg-neon-purple/8"
                      : "border-border-glass opacity-50 cursor-not-allowed",
                  )}
                >
                  <FileSpreadsheet className="h-5 w-5 text-neon-purple mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">{p.label}</span>
                    <span className="block text-[11px] text-text-muted mt-0.5">{p.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === "files" ? (
          <>
            <p className="text-sm text-text-muted">
              Toodledo → Account → Import / Export. Use the current export and, optionally, completed.
            </p>
            <FileDrop
              label="Current / open tasks"
              hint="These go through the review deck."
              file={currentFile}
              onFile={setCurrentFile}
            />
            <FileDrop
              label="Completed history"
              hint="Imported as done. Recurrence is ignored."
              file={completedFile}
              onFile={setCompletedFile}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setStep("platform")}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void goPreview()}>
                {busy ? "Reading…" : "Continue"}
              </button>
            </div>
          </>
        ) : null}

        {step === "preview" ? (
          <>
            {currentPreview ? (
              <div className="rounded-2xl border border-border-glass px-4 py-3">
                <div className="text-sm font-semibold">Open tasks</div>
                <p className="text-xs text-text-muted mt-1">
                  {currentPreview.rowCount} tasks · {currentPreview.recurringCount} recurring ·{" "}
                  {currentPreview.notesCount} with notes · {currentPreview.folderNames.length} folders
                </p>
              </div>
            ) : null}
            {completedPreview ? (
              <div className="rounded-2xl border border-border-glass px-4 py-3">
                <div className="text-sm font-semibold">Completed history</div>
                <p className="text-xs text-text-muted mt-1">
                  {completedPreview.rowCount.toLocaleString()} done tasks. Recurrence skipped. Not added to the
                  review deck.
                </p>
              </div>
            ) : null}
            {unmapped.length ? (
              <div className="rounded-2xl border border-amber-400/30 px-4 py-3 text-xs text-amber-300">
                Unmapped repeats: {unmapped.join(", ")}
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setStep("files")}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void runImport()}>
                Import
              </button>
            </div>
          </>
        ) : null}

        {step === "importing" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-sm text-text-muted">
            <Loader2 className="h-6 w-6 animate-spin text-neon-purple" />
            <div>{progress.label || "Importing…"}</div>
            {progress.total > 0 ? (
              <div className="w-full h-1.5 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className="h-full bg-neon-purple transition-all"
                  style={{ width: `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "preview" && currentPreview ? (
          <p className="text-[11px] text-text-muted flex items-center gap-1">
            <Check className="h-3 w-3 text-neon-purple" />
            After import you can review each open task before it appears on Tasks.
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
