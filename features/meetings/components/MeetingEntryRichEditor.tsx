"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { TipTapEditor } from "@/features/notes/editor/TipTapEditor";
import { EMPTY_AGENDA_DOC } from "@/lib/meetings/agendaEntryBody";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn } from "@/lib/utils";

interface MeetingEntryRichEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Remount key (e.g. after clear / switch entry). */
  editorKey?: string | number;
  className?: string;
  /** Collapsed composer height. */
  minHeight?: string;
  /** Compact toolbar for the docked composer. */
  compactToolbar?: boolean;
  onModEnter?: () => void;
}

export function MeetingEntryRichEditor({
  content,
  onChange,
  placeholder = "Log a note… (#decision tags decisions)",
  disabled,
  editorKey,
  className,
  minHeight = "120px",
  compactToolbar = false,
  onModEnter,
}: MeetingEntryRichEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useScrollLock(isExpanded);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (disabled) setIsExpanded(false);
  }, [disabled]);

  const editor = (
    <TipTapEditor
      key={editorKey}
      content={content || EMPTY_AGENDA_DOC}
      onChange={onChange}
      placeholder={placeholder}
      minHeight={isExpanded ? "100%" : minHeight}
      className={cn("flex-1 min-h-0", disabled && "pointer-events-none opacity-60")}
      variant="notebook"
      stickyToolbar
      compactToolbar={compactToolbar && !isExpanded}
    />
  );

  return (
    <>
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

      <div
        className={cn(
          "meeting-entry-rich-editor notebooks-note-editor flex flex-col min-h-0 min-w-0",
          isExpanded ? "notebooks-note-editor--expanded" : "relative",
          className,
        )}
        role={isExpanded ? "dialog" : undefined}
        aria-modal={isExpanded ? true : undefined}
        aria-label={isExpanded ? "Expanded meeting note editor" : undefined}
        onKeyDown={(e) => {
          if (onModEnter && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onModEnter();
          }
          if (e.key === "Escape" && isExpanded) {
            e.preventDefault();
            setIsExpanded(false);
          }
        }}
      >
        <div className="flex items-center justify-end gap-1 px-2 py-1.5 border-b border-border-glass shrink-0 bg-bg">
          <button
            type="button"
            onClick={() => setIsExpanded((open) => !open)}
            disabled={disabled}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover shrink-0 disabled:opacity-40"
            aria-label={isExpanded ? "Minimize note" : "Expand note"}
            title={isExpanded ? "Minimize note" : "Expand note"}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
        <div className="notebooks-note-editor__body meeting-entry-rich-editor__body flex-1 min-h-0 overflow-hidden flex flex-col">
          {editor}
        </div>
      </div>
    </>
  );
}

interface MeetingEntryBodyViewProps {
  body: string;
  className?: string;
}

/** Read-only TipTap rendering for saved agenda notes (legacy plain text still works). */
export function MeetingEntryBodyView({ body, className }: MeetingEntryBodyViewProps) {
  return (
    <TipTapEditor
      content={body || EMPTY_AGENDA_DOC}
      readOnly
      variant="notebook"
      minHeight="0"
      className={cn("meeting-entry-body-view", className)}
    />
  );
}
