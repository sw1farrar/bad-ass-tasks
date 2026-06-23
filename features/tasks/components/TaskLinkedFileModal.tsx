"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import {
  CaptureFileModal,
  type CaptureFileInput,
} from "@/features/files/components/CaptureFileModal";
import { collectWorkspaceTags } from "@/lib/files/fileFilters";
import { useNoteOperations } from "@/features/notes/hooks";
import { useNoteAttachmentCounts } from "@/features/notes/hooks";
import { useTaskStore } from "@/store/useTaskStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Note } from "@/types";
import { MobileDrawerShell } from "@/components/MobileDrawerShell";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";

interface TaskLinkedFileModalProps {
  open: boolean;
  onClose: () => void;
  noteId: string | null;
}

export function TaskLinkedFileModal({ open, onClose, noteId }: TaskLinkedFileModalProps) {
  const isMobile = useIsMobileViewport();
  const notes = useTaskStore((s) => s.notes);
  const tasks = useTaskStore((s) => s.tasks);
  const user = useTaskStore((s) => s.user);
  const currentWorkspace = useTaskStore((s) => s.currentWorkspace);
  const hydrateNoteDetail = useTaskStore((s) => s.hydrateNoteDetail);
  const addNote = useTaskStore((s) => s.addNote);
  const updateNote = useTaskStore((s) => s.updateNote);
  const deleteNote = useTaskStore((s) => s.deleteNote);
  const updateTask = useTaskStore((s) => s.updateTask);
  const completeTask = useTaskStore((s) => s.completeTask);
  const addTask = useTaskStore((s) => s.addTask);
  const selectTask = useTaskStore((s) => s.selectTask);

  const [fileNote, setFileNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isLive = isSupabaseConfigured() && !!user;
  const workspaceTags = useMemo(() => collectWorkspaceTags(notes), [notes]);

  const noteOps = useNoteOperations({
    notes,
    tasks,
    selectedNoteId: noteId,
    addNote,
    updateNote,
    deleteNote,
    updateTask,
    completeTask,
    addTask,
    openTask: (task) => selectTask(task.id),
    setPendingDeleteNote: () => {},
    isTrulyLive: isLive,
  });

  const {
    counts: attachmentCounts,
    setNoteCount,
  } = useNoteAttachmentCounts(currentWorkspace.id);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !noteId) {
      setFileNote(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const listNote = notes.find((n) => n.id === noteId) ?? null;
    if (listNote) setFileNote(listNote);

    void hydrateNoteDetail(noteId).then((hydrated) => {
      if (cancelled) return;
      setFileNote(hydrated ?? listNote);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, noteId, hydrateNoteDetail, notes]);

  const handleSaveEdit = useCallback(
    async (id: string, input: CaptureFileInput) => {
      await noteOps.onUpdateNote(id, {
        title: input.title,
        content: input.content,
        tags: input.tags,
        memo: input.memo || null,
        recordType: input.recordType,
      });
      const fresh = notes.find((n) => n.id === id);
      if (fresh) {
        setFileNote({
          ...fresh,
          title: input.title,
          content: input.content,
          tags: input.tags,
          memo: input.memo || null,
          recordType: input.recordType,
        });
      }
    },
    [noteOps.onUpdateNote, notes],
  );

  const handleToggleBookmark = useCallback(
    async (id: string, bookmarked: boolean) => {
      await noteOps.onUpdateNote(id, { bookmarked });
      setFileNote((prev) => (prev?.id === id ? { ...prev, bookmarked } : prev));
    },
    [noteOps.onUpdateNote],
  );

  if (!mounted) return null;

  if (open && loading && !fileNote) {
    return createPortal(
      <MobileDrawerShell
        open
        onClose={onClose}
        isMobile={isMobile}
        zIndex={290}
        panelClassName="max-w-md"
        ariaLabel="Loading linked file"
      >
        <div className="flex flex-col items-center justify-center gap-3 p-10 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin text-neon-purple" aria-hidden />
          <p className="text-sm">Loading linked file…</p>
        </div>
      </MobileDrawerShell>,
      document.body,
    );
  }

  return (
    <CaptureFileModal
      key={fileNote?.id ?? "task-linked-file"}
      isOpen={open && !!fileNote}
      mode="edit"
      initialNote={fileNote}
      onClose={onClose}
      workspaceTags={workspaceTags}
      isLive={isLive}
      tasks={tasks}
      linkedTaskIds={fileNote?.linkedTaskIds ?? []}
      onSaveEdit={handleSaveEdit}
      onToggleBookmark={handleToggleBookmark}
      onCreateTaskAndLink={noteOps.onCreateTaskAndLink}
      onLinkTaskToNote={noteOps.onLinkTaskToNote}
      onUnlinkTaskFromNote={noteOps.onUnlinkTaskFromNote}
      onOpenTask={(taskId) => {
        const task = tasks.find((t) => t.id === taskId);
        if (task) selectTask(task.id);
      }}
      onToggleTaskComplete={noteOps.onToggleTaskComplete}
      attachmentCountHint={fileNote ? (attachmentCounts[fileNote.id] ?? 0) : undefined}
      onAttachmentCountChange={setNoteCount}
    />
  );
}