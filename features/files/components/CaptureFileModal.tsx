"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Plus, CheckSquare, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { TipTapEditor } from "@/features/notes/editor";
import { LinkedTasksPanel, NoteAttachmentsPanel } from "@/features/notes/components";
import type { FileRecordType, Note, Task } from "@/types";
import { FILE_RECORD_TYPES, recordTypeLabel } from "@/lib/files/fileTypes";
import { noteContentToJson } from "@/lib/data/hybridStore";
import { resolveNoteEditorContent } from "@/lib/notes/resolveNoteEditorContent";
import { uploadFilesToNote } from "@/lib/files/uploadNoteAttachments";
import { invalidateNoteAttachments } from "@/lib/notes/noteAttachmentListCache";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { TagPicker } from "./TagPicker";
import { FileBookmarkButton } from "./FileBookmarkButton";
import { MobileDrawerShell } from "@/components/MobileDrawerShell";
import { useTaskStore } from "@/store/useTaskStore";

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
  onSubmit?: (
    input: CaptureFileInput,
    mode: CaptureFileSubmitMode,
    draftNoteId?: string,
  ) => Promise<void>;
  /** Live create mode: provision a draft note so attachments can upload immediately. */
  onCreateDraftNote?: () => Promise<Note | null>;
  /** Live create mode: discard an abandoned draft on cancel. */
  onDeleteDraftNote?: (noteId: string) => Promise<void>;
  onSaveEdit?: (noteId: string, input: CaptureFileInput) => Promise<void>;
  onToggleBookmark?: (noteId: string, bookmarked: boolean) => void | Promise<void>;
  onCreateTaskAndLink?: (noteId: string, title: string) => Promise<string | null>;
  onLinkTaskToNote?: (noteId: string, taskId: string) => Promise<void>;
  onUnlinkTaskFromNote?: (noteId: string, taskId: string) => Promise<void>;
  onOpenTask?: (taskId: string) => void;
  onToggleTaskComplete?: (taskId: string) => Promise<void>;
  attachmentCountHint?: number;
  onAttachmentCountChange?: (noteId: string, count: number) => void;
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

function hasEditChanges(snapshot: EditSnapshot | null, values: EditSnapshot) {
  if (!snapshot) return false;
  return (
    values.title.trim() !== snapshot.title.trim() ||
    !noteContentEqual(values.content, snapshot.content) ||
    values.memo.trim() !== snapshot.memo.trim() ||
    values.recordType !== snapshot.recordType ||
    !tagsEqual(values.tags, snapshot.tags)
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
  onToggleBookmark,
  onCreateDraftNote,
  onDeleteDraftNote,
  onCreateTaskAndLink,
  onLinkTaskToNote,
  onUnlinkTaskFromNote,
  onOpenTask,
  onToggleTaskComplete,
  attachmentCountHint,
  onAttachmentCountChange,
}: CaptureFileModalProps) {
  const isEdit = mode === "edit";
  const isMobile = useIsMobileViewport();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [recordType, setRecordType] = useState<FileRecordType>("note");
  const [content, setContent] = useState("");
  const [pendingTaskTitles, setPendingTaskTitles] = useState<string[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [saving, setSaving] = useState<CaptureFileSubmitMode | "save" | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [captureNote, setCaptureNote] = useState<Note | null>(null);
  const [attachmentRevision, setAttachmentRevision] = useState(0);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const openedSnapshotRef = useRef<EditSnapshot | null>(null);
  const draftPromiseRef = useRef<Promise<Note | null> | null>(null);
  const submittedRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [captureSession, setCaptureSession] = useState(0);

  const activeNote = isEdit ? initialNote : captureNote;
  const activeNoteId = activeNote?.id;
  const supportsLiveAttachments = isLive && isSupabaseConfigured() && !!activeNoteId;
  const liveLinkedTaskIds = useTaskStore((s) => {
    if (!activeNoteId) return undefined;
    return s.notes.find((n) => n.id === activeNoteId)?.linkedTaskIds;
  });
  const liveTasks = useTaskStore((s) => s.tasks);

  useEffect(() => {
    setMounted(true);
  }, []);
  /** True after TipTap's first normalized content emission has been baselined. */
  const editorContentBaselinedRef = useRef(false);

  useScrollLock(isOpen);

  const initialNoteId = initialNote?.id;
  const initialNoteRevision = initialNote?.updatedAt ?? initialNote?.createdAt;

  // Reset form state before paint so TipTap never mounts with stale content from the prior session.
  useLayoutEffect(() => {
    if (!isOpen) return;
    setCaptureSession((session) => session + 1);
    if (isEdit && initialNote) {
      const resolvedContent = resolveNoteEditorContent(initialNote);
      setTitle(initialNote.title || "");
      setTags((initialNote.tags ?? []).filter((t) => t !== "from-email").map((t) => t.toLowerCase()));
      setMemo(initialNote.memo ?? "");
      setRecordType(initialNote.recordType ?? "note");
      setContent(resolvedContent);
      setPendingTaskTitles([]);
    } else {
      const next = emptyState();
      setTitle(next.title);
      setTags(next.tags);
      setMemo(next.memo);
      setRecordType(next.recordType);
      setContent(next.content);
      setPendingTaskTitles(next.pendingTaskTitles);
    }
    setNewTaskTitle("");
    setSaving(null);
    setShowUnsavedConfirm(false);
    setCaptureNote(null);
    setAttachmentRevision(0);
    submittedRef.current = false;
    draftPromiseRef.current = null;
    openedSnapshotRef.current =
      isEdit && initialNote
        ? { ...snapshotFromNote(initialNote), content: resolveNoteEditorContent(initialNote) }
        : null;
    editorContentBaselinedRef.current = !isEdit;
  }, [isOpen, isEdit, initialNoteId, initialNoteRevision, initialNote]);

  useEffect(() => {
    if (!isOpen || isEdit || !isLive || !onCreateDraftNote) return;

    let cancelled = false;
    draftPromiseRef.current = onCreateDraftNote().then((note) => {
      if (!cancelled && note) setCaptureNote(note);
      return note;
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, isEdit, isLive, onCreateDraftNote]);

  useEffect(() => {
    if (isOpen) return;
    const draftId = captureNote?.id;
    if (draftId && !submittedRef.current && !isEdit && onDeleteDraftNote) {
      void onDeleteDraftNote(draftId);
    }
  }, [isOpen, captureNote?.id, isEdit, onDeleteDraftNote]);

  const ensureActiveNote = useCallback(async (): Promise<Note | null> => {
    if (activeNote) return activeNote;
    if (isEdit || !isLive || !onCreateDraftNote) return null;
    if (draftPromiseRef.current) return draftPromiseRef.current;
    draftPromiseRef.current = onCreateDraftNote().then((note) => {
      if (note) setCaptureNote(note);
      return note;
    });
    return draftPromiseRef.current;
  }, [activeNote, isEdit, isLive, onCreateDraftNote]);

  const handleAttachFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || !isLive || !isSupabaseConfigured()) return;

      setUploadingAttachments(true);
      try {
        const note = await ensureActiveNote();
        if (!note) {
          toast.error("Save the file first before attaching");
          return;
        }

        const { uploaded, errors } = await uploadFilesToNote(note.id, files);
        if (uploaded === 0) {
          toast.error(errors[0] || "Could not upload attachment");
          return;
        }
        if (uploaded < files.length) {
          toast.warning(`${uploaded} of ${files.length} files uploaded`);
        } else {
          toast.success(uploaded === 1 ? "Attachment added" : `${uploaded} attachments added`);
        }

        invalidateNoteAttachments(note.id);
        setAttachmentRevision((n) => n + 1);
        onAttachmentCountChange?.(
          note.id,
          (attachmentCountHint ?? 0) + uploaded,
        );
      } finally {
        setUploadingAttachments(false);
      }
    },
    [ensureActiveNote, isLive, attachmentCountHint, onAttachmentCountChange],
  );

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

  const addPendingTask = () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    setPendingTaskTitles((prev) => [...prev, trimmed]);
    setNewTaskTitle("");
  };

  const handleCreateLinkedTask = async () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed || creatingTask) return;

    const noteForLinking = activeNote;
    if (noteForLinking && onCreateTaskAndLink) {
      setCreatingTask(true);
      try {
        const taskId = await onCreateTaskAndLink(noteForLinking.id, trimmed);
        if (taskId) {
          setNewTaskTitle("");
          setCaptureNote((prev) =>
            prev?.id === noteForLinking.id
              ? {
                  ...prev,
                  linkedTaskIds: Array.from(
                    new Set([...(prev.linkedTaskIds ?? []), taskId]),
                  ),
                }
              : prev,
          );
        }
      } finally {
        setCreatingTask(false);
      }
      return;
    }

    addPendingTask();
  };

  const effectiveLinkedTaskIds =
    liveLinkedTaskIds ??
    (isEdit ? linkedTaskIds : captureNote?.linkedTaskIds ?? linkedTaskIds);

  const tasksForLinks = liveTasks.length > 0 ? liveTasks : tasks;
  const linkedTasks = effectiveLinkedTaskIds
    .map((id) => tasksForLinks.find((t) => t.id === id))
    .filter(Boolean) as Task[];

  const editNoteForTasks = activeNote
    ? {
        ...activeNote,
        linkedTaskIds: effectiveLinkedTaskIds.length
          ? effectiveLinkedTaskIds
          : activeNote.linkedTaskIds ?? [],
      }
    : null;

  const showEditLinkedTasksPanel =
    !!editNoteForTasks && isLive && !!onLinkTaskToNote && !!onUnlinkTaskFromNote;

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
          attachments: [],
          pendingTaskTitles,
        },
        submitMode,
        captureNote?.id,
      );
      submittedRef.current = true;
      setCaptureNote(null);
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
        attachments: [],
      });
      onClose();
    } finally {
      setSaving(null);
    }
  };

  if (!mounted || !isOpen) return null;

  const modalTitle = isEdit ? "Edit file" : "Add file";
  const modalSubtitle = isEdit
    ? "Update content, tags, and linked tasks — then save and close."
    : "Add tags and notes — drag files into the editor or use the paperclip to attach.";

  const editorMinHeight = isMobile ? "min(24dvh, 200px)" : "min(52dvh, 520px)";
  const safeX = "pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]";

  return createPortal(
    <>
      <MobileDrawerShell
        open={isOpen}
        onClose={requestClose}
        isMobile={isMobile}
        zIndex={290}
        panelClassName={cn(
          "capture-file-modal-shell",
          !isMobile && "sm:w-[min(96vw,1440px)] sm:max-h-[min(94dvh,94vh)]",
        )}
        ariaLabelledBy="capture-file-title"
      >
        <div
          className={cn(
            "shrink-0 flex items-center justify-between gap-3 py-4 border-b border-border-glass",
            safeX,
            isMobile ? "px-4" : "px-5",
          )}
        >
          <div>
            <h2 id="capture-file-title" className="text-lg font-semibold tracking-tight text-text-primary">
              {modalTitle}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">{modalSubtitle}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {isEdit && initialNote && onToggleBookmark && (
              <FileBookmarkButton
                bookmarked={!!initialNote.bookmarked}
                disabled={!!saving}
                onToggle={() => void onToggleBookmark(initialNote.id, !initialNote.bookmarked)}
              />
            )}
            <button
              type="button"
              onClick={requestClose}
              disabled={!!saving}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-muted"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "capture-file-modal-body flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4",
            safeX,
            isMobile ? "px-4 py-4" : "px-6 py-5 md:px-8",
          )}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <label className="block text-xs text-text-secondary md:col-span-12">
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What is this file?"
                className="mt-1 w-full input px-3 py-2.5 rounded-xl text-sm"
                autoFocus={!isMobile}
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

          {showEditLinkedTasksPanel && editNoteForTasks ? (
            <div className="capture-file-associated-tasks rounded-xl border border-border-glass bg-bg/60 overflow-hidden">
              <LinkedTasksPanel
                selectedNote={editNoteForTasks}
                tasks={tasksForLinks}
                onLinkTaskToNote={onLinkTaskToNote}
                onUnlinkTaskFromNote={onUnlinkTaskFromNote}
                onOpenTask={onOpenTask}
                onToggleTaskComplete={onToggleTaskComplete}
                onCreateTaskAndLink={onCreateTaskAndLink}
                compact={isMobile}
                embedded
              />
            </div>
          ) : (
            <div
              className={cn(
                "capture-file-associated-tasks rounded-xl border border-border-glass bg-bg/60 space-y-3",
                isMobile ? "p-3" : "p-4",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-neon-purple" />
                  Associated tasks
                </div>
                {(linkedTasks.length > 0 || pendingTaskTitles.length > 0) && (
                  <span className="text-[10px] font-mono text-neon-purple tabular-nums">
                    {linkedTasks.length + pendingTaskTitles.length} linked
                  </span>
                )}
              </div>

              {(linkedTasks.length > 0 || pendingTaskTitles.length > 0) && (
                <ul className="space-y-1.5">
                  {linkedTasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => onOpenTask?.(task.id)}
                        disabled={!onOpenTask}
                        className={cn(
                          "capture-file-linked-task w-full flex items-center gap-2 rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5 text-sm text-text-primary text-left transition min-h-[44px]",
                          onOpenTask && "hover:border-neon-purple/30 hover:bg-surface-hover active:scale-[0.99]",
                          !onOpenTask && "cursor-default",
                        )}
                      >
                        <CheckSquare className="h-4 w-4 shrink-0 text-neon-purple" />
                        <span className="flex-1 min-w-0 truncate">{task.title}</span>
                        <span className="text-[10px] text-text-faint uppercase tracking-wide shrink-0">
                          Linked
                        </span>
                      </button>
                    </li>
                  ))}
                  {pendingTaskTitles.map((taskTitle, index) => (
                    <li
                      key={`pending-${taskTitle}-${index}`}
                      className="flex items-center gap-2 rounded-xl border border-neon-purple/25 bg-neon-purple/5 px-3 py-2.5 text-sm text-neon-purple-tint min-h-[44px]"
                    >
                      <CheckSquare className="h-4 w-4 shrink-0" />
                      <span className="flex-1 min-w-0 truncate">{taskTitle}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingTaskTitles((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 text-text-muted hover:text-text-primary"
                        aria-label={`Remove ${taskTitle}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className={cn(isMobile ? "space-y-2" : "flex gap-2")}>
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
                  className={cn(
                    "input rounded-xl",
                    isMobile
                      ? "w-full min-h-[44px] px-3 py-2.5 text-base"
                      : "flex-1 px-3 py-2 text-sm",
                  )}
                  disabled={!!saving || creatingTask}
                />
                <button
                  type="button"
                  onClick={() => void handleCreateLinkedTask()}
                  disabled={!!saving || creatingTask || !newTaskTitle.trim()}
                  className={cn(
                    "flex items-center justify-center gap-1.5 text-sm font-semibold transition",
                    isMobile
                      ? "btn btn-primary w-full min-h-[44px] rounded-xl px-4 py-2.5"
                      : "btn btn-ghost shrink-0 px-3 py-2 border border-border-glass rounded-xl",
                    (!newTaskTitle.trim() || creatingTask) && isMobile && "opacity-45",
                  )}
                >
                  {creatingTask ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add task
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="text-xs text-text-secondary mb-1.5">Notes & images</div>
            <div
              className={cn(
                "capture-file-editor-shell rounded-xl border border-border-glass bg-bg overflow-x-auto overflow-y-visible",
                isMobile ? "min-h-[min(28dvh,240px)]" : "min-h-[min(52vh,520px)]",
              )}
            >
              <TipTapEditor
                key={
                  isEdit
                    ? initialNoteId ?? "edit"
                    : `capture-${captureSession}-${captureNote?.id ?? "pending"}`
                }
                noteId={activeNoteId}
                content={content}
                onChange={handleContentChange}
                placeholder="Jot notes, paste images, format text…"
                minHeight={editorMinHeight}
                compactToolbar={isMobile}
                showAttachFilesButton={isLive && isSupabaseConfigured()}
                onAttachFiles={isLive && isSupabaseConfigured() ? handleAttachFiles : undefined}
                belowToolbar={
                  supportsLiveAttachments && activeNote ? (
                    <NoteAttachmentsPanel
                      key={`${activeNote.id}-${attachmentRevision}`}
                      selectedNote={activeNote}
                      embedded
                      compact={isMobile}
                      previewCompact={!isMobile}
                      showWhenEmpty
                      countHint={attachmentCountHint}
                      onCountChange={onAttachmentCountChange}
                    />
                  ) : undefined
                }
              />
            </div>
          </div>

          {uploadingAttachments && (
            <p className="text-xs text-text-muted flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading attachment…
            </p>
          )}

          {!isLive && (
            <p className="text-xs text-text-muted rounded-lg border border-border-glass bg-surface-hover px-3 py-2">
              Demo mode: captures save locally. Live Supabase unlocks attachment uploads and email
              intake.
            </p>
          )}
        </div>

        <div
          className={cn(
            "shrink-0 flex gap-2 border-t border-border-glass bg-bg/80",
            safeX,
            isMobile
              ? "flex-col px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              : "flex-col-reverse sm:flex-row px-5 py-4",
          )}
        >
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
      </MobileDrawerShell>

      <MobileDrawerShell
        open={showUnsavedConfirm}
        onClose={() => setShowUnsavedConfirm(false)}
        isMobile={isMobile}
        zIndex={300}
        panelClassName={cn(
          "confirmation-modal confirmation-modal--unsaved task-unsaved-dialog",
          !isMobile && "max-w-md",
        )}
        ariaLabel="Save changes?"
      >
        <div className="p-5 pb-4">
          <h3 className="text-lg font-semibold text-text-primary tracking-tight">Save changes?</h3>
          <div className="mt-2 space-y-1.5">
            <p className="text-sm font-medium text-text-primary truncate">
              &ldquo;{title.trim() || initialNote?.title || "Untitled"}&rdquo;
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              You have unsaved changes. Save them before closing, or discard your edits.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setShowUnsavedConfirm(false)}
            className="confirmation-modal__cancel w-full min-h-[44px] rounded-xl border border-border-glass px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-hover transition"
          >
            Keep editing
          </button>
          <div className="flex flex-col-reverse sm:flex-row gap-2.5">
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
      </MobileDrawerShell>
    </>,
    document.body,
  );
}