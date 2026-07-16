"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { TipTapEditor } from "@/features/notes/editor/TipTapEditor";
import { NoteAttachmentsPanel } from "@/features/notes/components/NoteAttachmentsPanel";
import { uploadFilesToNote } from "@/lib/files/uploadNoteAttachments";
import { isNoteBodyHydrated } from "@/lib/files/noteListProjection";
import {
  flushPendingNoteFieldSave,
  schedulePendingNoteFieldSave,
} from "@/lib/notebooks/noteEditorSave";
import { noteContentEquivalent } from "@/lib/notes/noteUpdates";
import { invalidateNoteAttachments } from "@/lib/notes/noteAttachmentListCache";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn } from "@/lib/utils";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTitleRef = useRef<{ noteId: string; value: string } | null>(null);
  const pendingContentRef = useRef<{ noteId: string; value: string } | null>(null);
  const previousNoteIdRef = useRef<string | null>(null);
  const isTitleDirtyRef = useRef(false);
  /** Snapshots keyed by note id so flush-on-switch doesn't compare against the next note. */
  const titleByIdRef = useRef<Map<string, string>>(new Map());
  const contentByIdRef = useRef<Map<string, string>>(new Map());

  useScrollLock(isExpanded);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const saveTitle = useCallback(
    (noteId: string, value: string) => {
      const nextTitle = value.trim() || "Untitled note";
      const prevTitle = titleByIdRef.current.get(noteId) || "Untitled note";
      if (prevTitle === nextTitle) return;
      titleByIdRef.current.set(noteId, nextTitle);
      void onUpdateNote(noteId, { title: nextTitle });
    },
    [onUpdateNote],
  );

  const saveContent = useCallback(
    (noteId: string, value: string) => {
      const prevContent = contentByIdRef.current.get(noteId);
      // TipTap can emit normalized JSON on open; skip if body is unchanged.
      if (noteContentEquivalent(prevContent, value)) return;
      contentByIdRef.current.set(noteId, value);
      void onUpdateNote(noteId, { content: value });
    },
    [onUpdateNote],
  );

  useEffect(() => {
    if (!note) {
      setTitle("");
      isTitleDirtyRef.current = false;
      setIsExpanded(false);
      return;
    }
    isTitleDirtyRef.current = false;
    setTitle(note.title || "");
    titleByIdRef.current.set(note.id, note.title || "Untitled note");
    contentByIdRef.current.set(note.id, note.content ?? "");
    if (!isNoteBodyHydrated(note)) {
      void onHydrateNote(note.id);
    }
  }, [note?.id, onHydrateNote]);

  // Keep content snapshot in sync after hydrate without treating it as a user edit.
  useEffect(() => {
    if (!note || !isNoteBodyHydrated(note)) return;
    contentByIdRef.current.set(note.id, note.content ?? "");
  }, [note?.id, note?.content, note?.bodyHydrated]);

  useEffect(() => {
    setIsExpanded(false);
  }, [note?.id]);

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
  }, [focusTitle, note?.id, onTitleFocusConsumed]);

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setIsExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isExpanded]);

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
    <>
      {isExpanded && (
        <div className="notebooks-note-editor__dock-placeholder flex flex-1 flex-col items-center justify-center gap-3 min-h-0 min-w-0 px-6 text-center">
          <p className="text-sm text-text-muted">Editing in expanded view</p>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-surface-hover border border-border-glass"
          >
            <Minimize2 className="h-4 w-4" />
            Return to panel
          </button>
        </div>
      )}

      {isExpanded &&
        portalReady &&
        createPortal(
          <div
            className="notebooks-note-editor__backdrop"
            onClick={() => setIsExpanded(false)}
            aria-hidden="true"
          />,
          document.body,
        )}

      {/*
        Keep TipTap in this same React tree when expanding (position: fixed via CSS)
        so autosave + undo history continue without remounting.
      */}
      <div
        className={cn(
          "notebooks-note-editor flex flex-col min-h-0 min-w-0",
          isExpanded ? "notebooks-note-editor--expanded" : "flex-1",
        )}
        role={isExpanded ? "dialog" : undefined}
        aria-modal={isExpanded ? true : undefined}
        aria-label={isExpanded ? "Expanded note editor" : undefined}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-glass shrink-0">
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => {
              isTitleDirtyRef.current = true;
              setTitle(e.target.value);
              scheduleTitleSave(e.target.value);
            }}
            onBlur={() => {
              if (!isTitleDirtyRef.current) return;
              flushPendingNoteFieldSave(titleSaveTimer, pendingTitleRef, saveTitle);
              isTitleDirtyRef.current = false;
            }}
            placeholder="Note title"
            className="flex-1 min-w-0 bg-transparent text-lg font-semibold text-text-primary focus:outline-none placeholder:text-text-faint"
            aria-label="Note title"
          />
          <button
            type="button"
            onClick={() => setIsExpanded((open) => !open)}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover shrink-0"
            aria-label={isExpanded ? "Minimize note" : "Expand note"}
            title={isExpanded ? "Minimize note" : "Expand note"}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
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
    </>
  );
}
