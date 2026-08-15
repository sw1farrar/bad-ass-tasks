"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import type { MapStore } from "@/lib/maps/types";

interface CsvImportDialogProps {
  open: boolean;
  workspaceId: string;
  onOpenChange: (open: boolean) => void;
  onImported: (stores: MapStore[]) => void;
}

export function CsvImportDialog({
  open,
  workspaceId,
  onOpenChange,
  onImported,
}: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!file) {
      toast.error("Choose a CSV file");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("workspaceId", workspaceId);
      const res = await fetch("/api/maps/stores/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Import failed");
        return;
      }
      toast.success(`Imported ${data.imported} store(s)`);
      if (data.errors?.length) {
        toast.warning(`${data.errors.length} row error(s) — check console`);
        console.warn(data.errors);
      }
      onImported(data.stores ?? []);
      onOpenChange(false);
      setFile(null);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass w-full max-w-md rounded-2xl border border-border-glass p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Import stores from CSV</h2>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              Headers: name, address, store_number, city, state, postal_code, mission_types
              (pipe/comma separated), notes, latitude, longitude. Addresses without coordinates
              are geocoded automatically.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-text-muted hover:bg-surface-hover"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 py-2">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-neon-purple/20 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neon-purple"
          />
          <p className="text-xs text-text-muted">
            Example mission_types: <code>Pro Store|Commercial Store</code>
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-border-glass px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={loading || !file}
            className="inline-flex items-center gap-2 rounded-lg bg-neon-purple/90 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
