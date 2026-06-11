"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Paperclip, Upload, Loader2, Plus, CheckSquare, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { TipTapEditor } from "@/features/notes/editor";
import type { FileRecordType, Note, Task } from "@/types";
import { FILE_RECORD_TYPES, recordTypeLabel } from "@/lib/files/fileTypes";
import { noteContentToJson } from "@/lib/data/hybridStore";
import { resolveNoteEditorContent } from "@/lib/notes/resolveNoteEditorContent";
import { TagPicker } from "./TagPicker";

export type CaptureFileSubmitMode = "review" | "file";

export interface CaptureFileInput {
  title: string;
  content: string;
  tags: string[];
  memo: string;
  recordType: FileRecordType;
  attachments: File[];
  /** New task titles to create and link (create mode only) */
  pendingTaskTitles?: string[];
}

interface CaptureFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  initialNote?: Note | null;
  workspaceTags?: string[];
  isLive?: boolean;
  tasks?: Task[];
  linkedTaskIds?: string[];
  onSubmit?: (input: CaptureFileInput, mode: CaptureFileSubmitMode) => Promise<void>;
  onSaveEdit?: (noteId: string, input: CaptureFileInput) => Promise<void>;
  onCreateTaskAndLink?: (noteId: string, title: string) => Promise<string | null>;
}

function emptyState() {
  return {
    title: "",
    tags: [] as string[],
    memo: "",
    recordType: "note" as FileRecordType,
    content: "",
    attachments: [] as File[],
    pendingTaskTitles: [] as string[],
  };
}

type EditSnapshot = {
  title: string;
  content: string;
  tags: string[];
  memo: string;
  recordType: FileRecordType;
};

function normalizeTags(tags: string[]) {
  return [...tags]
    .filter((t) => t !== "from-email")
    .map((t) => t.toLowerCase())
    .sort();
}

function tagsEqual(a: string[], b: string[]) {
  const left = normalizeTags(a);
  const right = normalizeTags(b);
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

function canonicalNoteContentKey(content: string) {
  const json = noteContentToJson(content);
  if (!json) return "";
  return JSON.stringify(json);
}

function noteContentEqual(a: string, b: string) {
  return canonicalNoteContentKey(a) === canonicalNoteContentKey(b);
}

function snapshotFromNote(note: Note): EditSnapshot {
  return {
    title: note.title || "",
    content: note.content ?? "",
    tags: (note.tags ?? [])
      .filter((t) => t !== "from-email")
      .map((t) => t.toLowerCase()),
    memo: note.memo ?? "",
    recordType: note.recordType ?? "note",
  };
}

function hasEditChanges(
  snapshot: EditSnapshot | null,
  values: EditSnapshot & { attachments: File[] },
) {
  if (!snapshot) return false;
  return (
    values.title.trim() !== snapshot.title.trim() ||
    !noteContentEqual(values.content, snapshot.content) ||
    values.memo.trim() !== snapshot.memo.trim() ||
    values.recordType !== snapshot.recordType ||
    !tagsEqual(values.tags, snapshot.tags) ||
    values.attachments.length > 0
  );
}

export function CaptureFileModal({
  isOpen,
  onClose,
  mode = "create",
  initialNote = null,
  workspaceTags = [],
  isLive = true,
  tasks = [],
  linkedTaskIds = [],
  onSubmit,
  onSaveEdit,
  onCreateTaskAndLink,
}: CaptureFileModalProps) {
  const isEdit = mode === "edit";
  const isMobile = useIsMobileViewport();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [recordType, setRecordType] = useState<FileRecordType>("note");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [pendingTaskTitles, setPendingTaskTitles] = useState<string[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [saving, setSaving] = useState<CaptureFileSubmitMode | "save" | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openedSnapshotRef = useRef<EditSnapshot | null>(null);
  /** True after TipTap's first normalized content emission has been baselined. */
  const editorContentBaselinedRef = useRef(false);

  useScrollLock(isOpen);

  const initialNoteId = initialNote?.id;
  const initialNoteRevision = initialNote?.updatedAt ?? initialNote?.createdAt;

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && initialNote) {
      const resolvedContent = resolveNoteEditorContent(initialNote);
      setTitle(initialNote.title || "");
      setTags((initialNote.tags ?? []).filter((t) => t !== "from-email").map((t) => t.toLowerCase()));
      setMemo(initialNote.memo ?? "");
      setRecordType(initialNote.recordType ?? "note");
      setContent(resolvedContent);
      setAttachments([]);
      setPendingTaskTitles([]);
    } else {
      const next = emptyState();
      setTitle(next.title);
      setTags(next.tags);
      setMemo(next.memo);
      setRecordType(next.recordType);
      setContent(next.content);
      setAttachments(next.attachments);
      setPendingTaskTitles(next.pendingTaskTitles);
    }
    setNewTaskTitle("");
    setSaving(null);
    setShowUnsavedConfirm(false);
    setDragOver(false);
    openedSnapshotRef.current =
      isEdit && initialNote
        ? { ...snapshotFromNote(initialNote), content: resolveNoteEditorContent(initialNote) }
        : null;
    editorContentBaselinedRef.current = !isEdit;
  }, [isOpen, isEdit, initialNoteId, initialNoteRevision, initialNote]);

  const handleContentChange = useCallback(
    (next: string) => {
      setContent(next);
      // TipTap normalizes content on mount (e.g. "" → stringified empty doc).
      // Re-baseline once on the first editor emission so a no-edit close stays clean.
      if (isEdit && !editorContentBaselinedRef.current && openedSnapshotRef.current) {
        openedSnapshotRef.current = {
          ...openedSnapshotRef.current,
          content: next,
        };
        editorContentBaselinedRef.current = true;
      }
    },
    [isEdit],
  );

  const isDirty =
    isEdit &&
    hasEditChanges(openedSnapshotRef.current, {
      title,
      content,
      tags,
      memo,
      recordType,
      attachments,
    });

  const dismissWithoutSaving = useCallback(() => {
    setShowUnsavedConfirm(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (isDirty) {
      setShowUnsavedConfirm(true);
      return;
    }
    dismissWithoutSaving();
  }, [dismissWithoutSaving, isDirty, saving]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (showUnsavedConfirm) {
        setShowUnsavedConfirm(false);
        return;
      }
      requestClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, requestClose, showUnsavedConfirm]);

  const addFiles = useCallback((files: FileList | File[] | null) => {
    if (!files?.length) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  }, []);

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const addPendingTask = () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    setPendingTaskTitles((prev) => [...prev, trimmed]);
    setNewTaskTitle("");
  };

  const handleCreateLinkedTask = async () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed || creatingTask) return;

    if (isEdit && initialNote && onCreateTaskAndLink) {
      setCreatingTask(true);
      try {
        const taskId = await onCreateTaskAndLink(initialNote.id, trimmed);
        if (taskId) setNewTaskTitle("");
      } finally {
        setCreatingTask(false);
      }
      return;
    }

    addPendingTask();
  };

  const linkedTasks = linkedTaskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as Task[];

  const handleSubmit = async (submitMode: CaptureFileSubmitMode) => {
    if (saving || !onSubmit) return;
    setSaving(submitMode);
    try {
      await onSubmit(
        {
          title: title.trim() || "Untitled",
          content,
          tags,
          memo: memo.trim(),
          recordType,
          attachments,
          pendingTaskTitles,
        },
        submitMode,
      );
      onClose();
    } finally {
      setSaving(null);
    }
  };

  const handleSaveEdit = async () => {
    if (saving || !isEdit || !initialNote || !onSaveEdit) return;
    setSaving("save");
    try {
      await onSaveEdit(initialNote.id, {
        title: title.trim() || "Untitled",
        content,
        tags,
        memo: memo.trim(),
        recordType,
        attachments,
      });
      onClose();
    } finally {
      setSaving(null);
    }
  };

  if (!isOpen) return null;

  const modalTitle = isEdit ? "Edit file" : "Add file";
  const modalSubtitle = isEdit
    ? "Update content, tags, and linked tasks — then save and close."
    : "Add everything at once — tags, notes, images, and attachments.";

  const modalShellClass =
    "sm:w-[min(96vw,1440px)] sm:max-h-[94vh] max-h-[94vh]";
  const modalBodyClass = "px-6 py-5 md:px-8";
  const editorMinHeight = "min(52vh, 520px)";

  return (
    <div className="fixed inset-0 z-[290] flex items-end sm:items-center justify-center p-0 sm:p-3 md:p-4">
      <button
        type="button"
        className="absolute inset-0 overlay-scrim backdrop-blur-sm"
        onClick={requestClose}
        aria-label="Close"
      />
      <div
        className={cn(
          "relative flex flex-col w-full rounded-t-2xl sm:rounded-2xl border border-border-glass modal-panel bg-bg-panel shadow-2xl overflow-hidden",
          modalShellClass,
        )}
        role="dialog"
        aria-labelledby="capture-file-title"
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-border-glass">
          <div>
            <h2 id="capture-file-title" className="text-lg font-semibold tracking-tight text-text-primary">
              {modalTitle}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">{modalSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={!!saving}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={cn("flex-1 min-h-0 overflow-y-auto space-y-4", modalBodyClass)}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <label className="block text-xs text-text-secondary md:col-span-12">
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What is this file?"
                className="mt-1 w-full input px-3 py-2.5 rounded-xl text-sm"
                autoFocus
              />
            </label>

            <div className="block text-xs text-text-secondary md:col-span-7">
              <div className="mb-1">Tags</div>
              <TagPicker
                availableTags={workspaceTags}
                selected={tags}
                onChange={setTags}
                disabled={!!saving}
              />
            </div>

            <label className="block text-xs text-text-secondary md:col-span-5">
              Type
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as FileRecordType)}
                className="mt-1 w-full input px-3 py-2.5 rounded-xl text-sm"
              >
                {FILE_RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {recordTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs text-text-secondary">
            Memo <span className="text-text-faint">(optional)</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full input px-3 py-2.5 rounded-xl text-sm resize-none"
              placeholder="e.g. March electric bill from Acme"
              aria-describedby="capture-memo-hint"
            />
            <span id="capture-memo-hint" className="mt-1 block text-[10px] text-text-faint leading-snug">
              One line shown under the title in your file list and included when you search files.
            </span>
          </label>

          <div>
            <div className="text-xs text-text-secondary mb-1.5">Notes & images</div>
            <div
              className="capture-file-editor-shell rounded-xl border border-border-glass bg-bg overflow-x-hidden min-h-[min(52vh,520px)]"
            >
              <TipTapEditor
                key={isEdit ? initialNoteId ?? "edit" : "create"}
                noteId={isEdit ? initialNoteId : undefined}
                content={content}
                onChange={handleContentChange}
                placeholder="Jot notes, paste images, format text…"
                minHeight={editorMinHeight}
                compactToolbar={isMobile}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border-glass bg-bg/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Link2 className="h-3.5 w-3.5 text-neon-purple" />
              Associated tasks
            </div>

            {(linkedTasks.length > 0 || pendingTaskTitles.length > 0) && (
              <ul className="space-y-1.5">
                {linkedTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-2 rounded-lg border border-border-glass bg-bg-secondary px-3 py-2 text-sm text-text-primary"
                  >
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-neon-purple" />
                    <span className="flex-1 min-w-0 truncate">{task.title}</span>
                    <span className="text-[10px] text-text-faint uppercase tracking-wide">Linked</span>
                  </li>
                ))}
                {pendingTaskTitles.map((taskTitle, index) => (
                  <li
                    key={`pending-${taskTitle}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-neon-purple/25 bg-neon-purple/5 px-3 py-2 text-sm text-neon-purple-tint"
                  >
                    <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{taskTitle}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingTaskTitles((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="text-text-muted hover:text-text-primary"
                      aria-label={`Remove ${taskTitle}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreateLinkedTask();
                  }
                }}
                placeholder="Create a task to link to this file"
                className="flex-1 input px-3 py-2 rounded-xl text-sm"
                disabled={!!saving || creatingTask}
              />
              <button
                type="button"
                onClick={() => void handleCreateLinkedTask()}
                disabled={!!saving || creatingTask || !newTaskTitle.trim()}
                className="btn btn-ghost shrink-0 px-3 py-2 text-sm border border-border-glass flex items-center gap-1.5"
              >
                {creatingTask ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add task
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs text-text-secondary mb-1.5">Attachments</div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "rounded-xl border border-dashed px-4 py-5 text-center transition",
                dragOver
                  ? "border-neon-purple/50 bg-neon-purple/5"
                  : "border-border-glass bg-bg/60",
              )}
            >
              <Upload className="h-5 w-5 mx-auto text-text-muted mb-2" />
              <p className="text-sm text-text-secondary">
                Drop files here or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-neon-purple hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="text-[10px] text-text-faint mt-1">PDF, images, docs — up to 50 MB each</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {attachments.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-border-glass bg-bg-secondary px-3 py-2 text-sm"
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    <span className="flex-1 min-w-0 truncate text-text-primary">{file.name}</span>
                    <span className="text-[10px] text-text-faint shrink-0">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-text-muted hover:text-text-primary px-1"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isLive && (
            <p className="text-xs text-text-muted rounded-lg border border-border-glass bg-surface-hover px-3 py-2">
              Demo mode: captures save locally. Live Supabase unlocks attachment uploads and email
              intake.
            </p>
          )}
        </div>

        <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 px-5 py-4 border-t border-border-glass bg-bg/80">
          <button
            type="button"
            onClick={requestClose}
            disabled={!!saving}
            className="btn btn-ghost flex-1 py-2.5 text-sm"
          >
            Cancel
          </button>
          {isEdit ? (
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              disabled={!!saving}
              className={cn("btn btn-primary flex-1 py-2.5 text-sm", saving === "save" && "opacity-60")}
            >
              {saving === "save" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                "Save & close"
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleSubmit("file")}
                disabled={!!saving}
                className={cn(
                  "btn btn-ghost flex-1 py-2.5 text-sm border border-border-glass",
                  saving === "file" && "opacity-60",
                )}
              >
                {saving === "file" ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Filing…
                  </span>
                ) : (
                  "File now"
                )}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit("review")}
                disabled={!!saving}
                className={cn("btn btn-primary flex-1 py-2.5 text-sm", saving === "review" && "opacity-60")}
              >
                {saving === "review" ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </span>
                ) : (
                  "Add to Review"
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-4">
          <div
            className="absolute inset-0 overlay-scrim backdrop-blur-[3px]"
            onClick={() => setShowUnsavedConfirm(false)}
            aria-hidden
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="file-unsaved-title"
            aria-describedby="file-unsaved-desc"
            className={cn(
              "confirmation-modal confirmation-modal--unsaved task-unsaved-dialog relative w-full max-w-md bg-bg-panel border border-border-glass modal-panel shadow-2xl",
              "rounded-t-2xl md:rounded-2xl",
              "pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-0",
              "animate-in fade-in slide-in-from-bottom-4 md:zoom-in-95 duration-200",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2.5 md:hidden">
              <div className="confirmation-modal__drag-handle h-1 w-10 rounded-full" aria-hidden />
            </div>
            <div className="p-5 pb-4">
              <h3 id="file-unsaved-title" className="text-lg font-semibold text-text-primary tracking-tight">
                Save changes?
              </h3>
              <div id="file-unsaved-desc" className="mt-2 space-y-1.5">
                <p className="text-sm font-medium text-text-primary truncate">
                  &ldquo;{title.trim() || initialNote?.title || "Untitled"}&rdquo;
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  You have unsaved changes. Save them before closing, or discard your edits.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowUnsavedConfirm(false)}
                className="confirmation-modal__cancel w-full min-h-[44px] rounded-xl border border-border-glass px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-hover transition"
              >
                Keep editing
              </button>
              <div className="flex flex-col-reverse md:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={dismissWithoutSaving}
                  disabled={!!saving}
                  className="confirmation-modal__discard flex-1 min-h-[44px] rounded-xl border border-[var(--priority-p0)]/35 px-4 py-2.5 text-sm font-semibold text-[var(--priority-p0)]/70 hover:bg-[var(--priority-p0)]/15 disabled:opacity-50 transition"
                >
                  Discard changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedConfirm(false);
                    void handleSaveEdit();
                  }}
                  disabled={!!saving}
                  className="confirmation-modal__save btn btn-primary flex-1 min-h-[44px] px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition"
                >
                  Save and close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}