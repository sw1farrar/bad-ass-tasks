"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";
import {
  NOTEBOOK_SECTION_TABS,
  REQUIRED_NOTEBOOK_SECTION,
  normalizeNotebookEnabledSections,
  resolveNotebookEnabledSections,
  type NotebookSectionTab,
} from "@/lib/notebooks/notebookSections";
import type { Notebook } from "@/types";

interface EditNotebookModalProps {
  open: boolean;
  notebook: Notebook | null;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: string,
    updates: Partial<Pick<Notebook, "name" | "enabledSections">>,
  ) => void | Promise<unknown>;
}

export function EditNotebookModal({
  open,
  notebook,
  onOpenChange,
  onSave,
}: EditNotebookModalProps) {
  const [name, setName] = useState("");
  const [enabledSections, setEnabledSections] = useState<NotebookSectionTab[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !notebook) return;
    setName(notebook.name);
    setEnabledSections(resolveNotebookEnabledSections(notebook));
    setIsSaving(false);
  }, [open, notebook]);

  const toggleSection = (section: NotebookSectionTab) => {
    if (section === REQUIRED_NOTEBOOK_SECTION) return;
    setEnabledSections((current) => {
      const next = current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section];
      return normalizeNotebookEnabledSections(next);
    });
  };

  const handleSubmit = async () => {
    if (!notebook) return;
    const trimmedName = name.trim() || "Untitled notebook";
    const normalizedSections = normalizeNotebookEnabledSections(enabledSections);

    setIsSaving(true);
    try {
      await onSave(notebook.id, {
        name: trimmedName,
        enabledSections: normalizedSections,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save notebook");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => !isSaving && onOpenChange(false)}
      title="Edit notebook"
      mobileHeight="90"
      enableDragDismiss={!isSaving}
      zIndex={1000}
      desktopMaxWidth="max-w-md"
      panelClassName="edit-notebook-modal"
      ariaLabel="Edit notebook"
    >
      <p className="px-5 text-sm text-text-muted -mt-1 mb-3">
        Rename this notebook and choose which sections appear in it.
      </p>

      <div className="px-5 space-y-5">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Notebook name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit();
            }}
            disabled={isSaving}
            className="w-full min-h-[44px] bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40 disabled:opacity-50"
            aria-label="Notebook name"
            autoFocus
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Sections to include
          </legend>
          <div className="space-y-2">
            {NOTEBOOK_SECTION_TABS.map((tab) => {
              const isChecked = enabledSections.includes(tab.id);
              const isRequired = tab.id === REQUIRED_NOTEBOOK_SECTION;

              return (
                <label
                  key={tab.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-3 transition",
                    isChecked
                      ? "border-neon-purple/25 bg-neon-purple/8"
                      : "border-border-glass bg-bg-secondary/40",
                    isRequired ? "cursor-default" : "cursor-pointer hover:bg-surface-hover",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isSaving || isRequired}
                    onChange={() => toggleSection(tab.id)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                      isChecked
                        ? "border-neon-purple/40 bg-neon-purple/20 text-neon-purple-tint"
                        : "border-border-glass bg-bg",
                    )}
                    aria-hidden
                  >
                    {isChecked ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text-primary">{tab.label}</span>
                    {isRequired ? (
                      <span className="block text-xs text-text-muted">Always included</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="keyboard-stable-sheet__footer flex items-center justify-end gap-2 px-5 pt-4 mt-4 border-t border-border-glass bg-bg-secondary/40">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={isSaving}
          className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSaving || !name.trim()}
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-4 py-2 text-sm font-medium text-neon-purple-tint disabled:opacity-40"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </button>
      </div>
    </BottomSheet>
  );
}
