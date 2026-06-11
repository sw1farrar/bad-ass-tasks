"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

interface CreateWorkspaceGateProps {
  userEmail?: string | null;
  onCreate: (name: string) => Promise<boolean>;
  isCreating?: boolean;
}

export function CreateWorkspaceGate({ userEmail, onCreate, isCreating = false }: CreateWorkspaceGateProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useScrollLock(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a workspace name to continue.");
      return;
    }
    setError(null);
    const ok = await onCreate(trimmed);
    if (!ok) {
      setError("Could not create your workspace. Try again.");
    }
  };

  return (
    <div className="create-workspace-gate fixed inset-0 z-[200] flex items-center justify-center bg-bg p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(192,132,252,0.14),transparent)]" />

      <div className="create-workspace-gate__panel relative w-full max-w-md rounded-3xl border border-border-glass modal-panel bg-bg-secondary/95 shadow-2xl overflow-hidden">
        <div className="create-workspace-gate__header px-8 pt-8 pb-6 text-center border-b border-border-subtle bg-gradient-to-b from-neon-purple/10 to-transparent">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-neon-purple to-neon-purple-dark flex items-center justify-center">
            <Check className="h-6 w-6 text-accent-on" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary mb-2">
            Create your workspace
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            {userEmail
              ? `You're signed in as ${userEmail}. Name your workspace to get started.`
              : "Name your workspace to get started."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && (
            <div className="rounded-xl border border-[var(--priority-p1)]/40 bg-bg-secondary px-3 py-2 text-xs text-[var(--priority-p1)]">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="create-workspace-name"
              className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5"
            >
              Workspace name
            </label>
            <input
              id="create-workspace-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Farrar Home"
              className="input w-full px-4 py-3 rounded-2xl text-base"
              required
              autoFocus
              disabled={isCreating}
              autoComplete="organization"
            />
          </div>

          <button
            type="submit"
            disabled={isCreating || !name.trim()}
            className="btn btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating workspace…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Create workspace
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}