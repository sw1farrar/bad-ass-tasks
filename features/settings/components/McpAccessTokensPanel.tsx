"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useTaskStore } from "@/store/useTaskStore";

type TokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function McpAccessTokensPanel() {
  const user = useTaskStore((s) => s.user);
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Grok bot");
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<TokenSummary | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/mcp/tokens");
      const data = await res.json();
      if (res.ok) setTokens(data.tokens ?? []);
    } catch {
      // table may not exist yet
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not create token");
        return;
      }
      setPlaintext(data.token);
      setTokens((current) => [data.summary, ...current]);
      toast.success("Token created — copy it now. It will not be shown again.");
    } finally {
      setCreating(false);
    }
  };

  const copyToken = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Token copied");
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  };

  const confirmRevoke = async () => {
    if (!pendingRevoke) return;
    const res = await fetch(`/api/mcp/tokens/${pendingRevoke.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not revoke token");
      return;
    }
    setTokens((current) => current.filter((token) => token.id !== pendingRevoke.id));
    setPendingRevoke(null);
    toast.success("Token revoked");
  };

  if (!user || !isSupabaseConfigured()) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] md:text-xs text-text-muted leading-relaxed">
        Keep grok.com on <span className="font-mono text-text-secondary">https://badazztasks.com/api/mcp</span>{" "}
        (login card). For Grok Bot, use{" "}
        <span className="font-mono text-text-secondary">https://badazztasks.com/api/mcp/bot</span>{" "}
        and a Bearer token from this panel. Do not share your password.
      </p>

      {plaintext && (
        <div className="settings-inbox-hint rounded-xl border border-neon-purple/30 bg-neon-purple/5 p-4 space-y-2">
          <p className="text-xs font-medium text-text-primary">Copy this token now</p>
          <p className="text-[11px] text-text-muted">
            It will not be shown again. Treat it like a password.
          </p>
          <div className="settings-inbox-email flex items-center gap-2 rounded-xl border border-neon-purple/20 bg-bg-secondary px-3 py-2.5">
            <code className="min-w-0 flex-1 truncate text-xs text-text-primary">{plaintext}</code>
            <button
              type="button"
              onClick={() => copyToken(plaintext)}
              className="settings-inbox-copy flex items-center gap-1 rounded-lg border border-border-glass px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-text-secondary hover:bg-surface-hover hover:text-text-primary shrink-0"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Grok bot"
          className="min-h-[40px] flex-1 rounded-xl border border-border-glass bg-bg-secondary px-3 text-sm text-text-primary"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || tokens.length >= 5}
          className="settings-inbox-create w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-4 py-2.5 text-sm text-neon-purple-tint hover:bg-neon-purple/15 disabled:opacity-50 min-h-[40px]"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create token
        </button>
      </div>

      {loading && tokens.length === 0 ? (
        <p className="text-xs text-text-muted">Loading tokens…</p>
      ) : tokens.length === 0 ? (
        <p className="text-xs text-text-muted">No bot tokens yet.</p>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="settings-inbox-card flex items-center justify-between gap-3 rounded-xl border border-border-glass p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-text-primary">
                  <KeyRound className="h-3.5 w-3.5 shrink-0 text-neon-purple" />
                  <span className="truncate font-medium">{token.name}</span>
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-text-muted">
                  {token.tokenPrefix}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingRevoke(token)}
                className="shrink-0 rounded-lg border border-border-glass p-2 text-text-muted hover:text-[var(--priority-p0)]"
                aria-label={`Revoke ${token.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        open={!!pendingRevoke}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null);
        }}
        title="Revoke MCP token?"
        highlight={pendingRevoke?.name}
        description="This token will stop working immediately. Bots using it will need a new token."
        confirmText="Revoke"
        variant="destructive"
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
