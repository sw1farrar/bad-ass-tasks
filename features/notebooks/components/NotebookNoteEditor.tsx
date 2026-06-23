"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { TipTapEditor } from "@/features/notes/editor/TipTapEditor";
import { NoteAttachmentsPanel } from "@/features/notes/components/NoteAttachmentsPanel";
import { uploadFilesToNote } from "@/lib/files/uploadNoteAttachments";
import { isNoteBodyHydrated } from "@/lib/files/noteListProjection";
import {
  flushPendingNoteFieldSave,
  schedulePendingNoteFieldSave,
} from "@/lib/notebooks/noteEditorSave";
import { invalidateNoteAttachments } from "@/lib/notes/noteAttachmentListCache";
import { toast } from "sonner";
import type { Note } from "@/types";

interface NotebookNoteEditorProps {
  note: Note | null;
  isLive: boolean;
  /** When true for the current note, focus the title and select all text (new note flow). */
  focusTitle?: boolean;
  onTitleFocusConsumed?: () => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => Promise<boolean | null>;
  onDeleteNote: (id: string) => Promise<boolean | null>;
  onHydrateNote: (id: string) => Promise<Note | null>;
  onRequestDelete?: (id: string) => void;
}

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

export function NotebookNoteEditor({
  note,
  isLive,
  focusTitle = false,
  onTitleFocusConsumed,
  onUpdateNote,
  onDeleteNote,
  onHydrateNote,
  onRequestDelete,
}: NotebookNoteEditorProps) {
  const [title, setTitle] = useState("");
  const [attachmentRevision, setAttachmentRevision] = useState(0);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTitleRef = useRef<{ noteId: string; value: string } | null>(null);
  const pendingContentRef = useRef<{ noteId: string; value: string } | null>(null);
  const previousNoteIdRef = useRef<string | null>(null);

  const saveTitle = useCallback(
    (noteId: string, value: string) => {
      void onUpdateNote(noteId, { title: value.trim() || "Untitled note" });
    },
    [onUpdateNote],
  );

  const saveContent = useCallback(
    (noteId: string, value: string) => {
      void onUpdateNote(noteId, { content: value });
    },
    [onUpdateNote],
  );

  useEffect(() => {
    if (!note) return;
    setTitle(note.title || "");
    if (!isNoteBodyHydrated(note)) {
      void onHydrateNote(note.id);
    }
  }, [note?.id, note?.title, note, onHydrateNote]);

  useEffect(() => {
    const prevId = previousNoteIdRef.current;
    const nextId = note?.id ?? null;
    if (prevId && prevId !== nextId) {
      flushPendingNoteFieldSave(titleSaveTimer, pendingTitleRef, saveTitle);
      flushPendingNoteFieldSave(contentSaveTimer, pendingContentRef, saveContent);
    }
    previousNoteIdRef.current = nextId;
  }, [note?.id, saveTitle, saveContent]);

  useEffect(() => {
    return () => {
      flushPendingNoteFieldSave(titleSaveTimer, pendingTitleRef, saveTitle);
      flushPendingNoteFieldSave(contentSaveTimer, pendingContentRef, saveContent);
    };
  }, [saveTitle, saveContent]);

  useEffect(() => {
    if (!focusTitle || !note) return;
    const frame = requestAnimationFrame(() => {
      const input = titleInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
      onTitleFocusConsumed?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTitle, note?.id, note?.title, onTitleFocusConsumed]);

  const scheduleTitleSave = useCallback(
    (nextTitle: string) => {
      if (!note) return;
      schedulePendingNoteFieldSave(
        note.id,
        nextTitle,
        titleSaveTimer,
        pendingTitleRef,
        saveTitle,
        500,
      );
    },
    [note, saveTitle],
  );

  const scheduleContentSave = useCallback(
    (content: string) => {
      if (!note) return;
      schedulePendingNoteFieldSave(
        note.id,
        content,
        contentSaveTimer,
        pendingContentRef,
        saveContent,
        600,
      );
    },
    [note, saveContent],
  );

  const handleAttachFiles = useCallback(
    async (files: File[]) => {
      if (!note) return;
      if (!isLive) {
        toast.error("Sign in to attach files");
        return;
      }
      const { uploaded, errors } = await uploadFilesToNote(note.id, files);
      if (uploaded === 0) {
        toast.error(errors[0] || "Could not upload attachment");
        return;
      }
      if (uploaded < files.length) {
        toast.warning(
          errors[0]
            ? `${uploaded} of ${files.length} files uploaded — ${errors[0]}`
            : `${uploaded} of ${files.length} files uploaded`,
        );
      } else {
        toast.success(uploaded === 1 ? "Attachment added" : `${uploaded} attachments added`);
      }
      invalidateNoteAttachments(note.id);
      setAttachmentRevision((n) => n + 1);
    },
    [note, isLive],
  );

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-text-muted">
        Select a note or create one to start writing.
      </div>
    );
  }

  const bodyReady = isNoteBodyHydrated(note);

  return (
    <div className="notebooks-note-editor flex flex-1 flex-col min-h-0 min-w-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-glass shrink-0">
        <input
          ref={titleInputRef}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleTitleSave(e.target.value);
          }}
          onBlur={() => {
            flushPendingNoteFieldSave(titleSaveTimer, pendingTitleRef, saveTitle);
            void onUpdateNote(note.id, { title: title.trim() || "Untitled note" });
          }}
          placeholder="Note title"
          className="flex-1 min-w-0 bg-transparent text-lg font-semibold text-text-primary focus:outline-none placeholder:text-text-faint"
          aria-label="Note title"
        />
        <button
          type="button"
          onClick={() => (onRequestDelete ? onRequestDelete(note.id) : void onDeleteNote(note.id))}
          className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
          aria-label="Delete note"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="notebooks-note-editor__body flex-1 min-h-0 overflow-hidden flex flex-col">
        {!bodyReady ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-text-muted py-12">
            <Loader2 className="h-4 w-4 animate-spin text-neon-purple" />
            Loading note…
          </div>
        ) : (
          <TipTapEditor
            key={note.id}
            noteId={note.id}
            content={note.content || EMPTY_DOC}
            onChange={scheduleContentSave}
            placeholder="Start writing… Use Tab / Shift+Tab to indent lists."
            minHeight="100%"
            className="flex-1 min-h-0"
            variant="notebook"
            stickyToolbar
            onAttachFiles={handleAttachFiles}
            showAttachFilesButton
            belowToolbar={
              isLive ? (
                <NoteAttachmentsPanel
                  key={`${note.id}-${attachmentRevision}`}
                  selectedNote={note}
                  embedded
                  showWhenEmpty
                />
              ) : null
            }
          />
        )}
      </div>
    </div>
  );
}