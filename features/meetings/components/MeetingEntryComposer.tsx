"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { MeetingEntryRichEditor } from "./MeetingEntryRichEditor";
import {
  EMPTY_AGENDA_DOC,
  isEmptyAgendaEntryBody,
} from "@/lib/meetings/agendaEntryBody";

interface MeetingEntryComposerProps {
  disabled?: boolean;
  onSubmit: (body: string) => void | Promise<void>;
}

export function MeetingEntryComposer({ disabled, onSubmit }: MeetingEntryComposerProps) {
  const [body, setBody] = useState(EMPTY_AGENDA_DOC);
  const [editorKey, setEditorKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = !disabled && !isSubmitting && !isEmptyAgendaEntryBody(body);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(body);
      setBody(EMPTY_AGENDA_DOC);
      setEditorKey((k) => k + 1);
    } catch {
      toast.error("Could not save note");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="meeting-entry-composer shrink-0 border-t border-border-glass p-3 bg-bg">
      <div className="flex gap-2 items-end">
        <MeetingEntryRichEditor
          content={body}
          onChange={setBody}
          disabled={disabled || isSubmitting}
          editorKey={editorKey}
          className="flex-1 min-w-0 rounded-xl border border-border-glass overflow-hidden"
          minHeight="112px"
          onModEnter={() => void handleSubmit()}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="btn btn-primary p-2.5 rounded-xl shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Add note"
          title="Add note (Ctrl+Enter)"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-text-faint px-0.5">
        Paste keeps formatting. Expand for a larger editor. Ctrl+Enter to send.
      </p>
    </div>
  );
}
