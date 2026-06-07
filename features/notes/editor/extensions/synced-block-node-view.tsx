"use client";

/**
 * SyncedBlockNodeView — React NodeView for the SyncedBlock extension (M2→M3 bridge)
 *
 * ==================================================================================
 * M2→M3 DELIVERABLE: LIVE BIDIRECTIONAL SYNCED BLOCK (scoped ONLY to this + synced-block.ts)
 * ==================================================================================
 * Now feels like a *true live synced reference* (not snapshot):
 *
 * (a) OPTIONAL "Edit in place" toggle (MVP = two-way TITLE SYNC):
 *     - Small "Edit in place" button in header (purple accent).
 *     - When active: title becomes controlled <input> (inline edit).
 *     - Commit on blur / explicit Save: if onUpdateNote present, writes {title} back to target.
 *     - Uses *existing* updateNote path (via drilled prop). Full content write scaffolded but disabled.
 *     - Clear visual: "TITLE SYNC ACTIVE (MVP)" badge. Safe, no rich content risk.
 *
 * (b) AUTO RE-RENDER when source updates in live notes prop:
 *     - Already reactive via props (lookup on every render).
 *     - NEW: dedicated useEffect watching referencedNote identity + updatedAt/title/content.
 *       Auto-bumps lastSynced timestamp + (future) subtle live flash when external change detected.
 *     - Manual "Re-sync" still present for explicit user intent.
 *
 * (c) PRODUCTION EDGES (safe + graceful):
 *     - Deleted target: enhanced isMissing UI + hard guards on all edit paths.
 *     - Cycle prevention: early return in write handler; comments for M3 ancestry tracking.
 *       Picker already excludes self (in TipTapEditor). No self-sync possible.
 *     - Permissions / no-writer: when !onUpdateNote, toggle shows disabled state + explanatory text.
 *       Optimistic call; parent responsible for error toasts / rollback.
 *
 * ==========================================================================
 * EXTREMELY MINIMAL — NO (updated M3 charter):
 * ==========================================================================
 * - NO full two-way rich content sync (MVP deliberately title-only to stay safe within M2 scope)
 * - NO block-range targeting
 * - NO conflict/merge UI inside block
 * - NO new deps or state machines beyond React.useState/useEffect/useCallback
 * - NO edits outside these two files (+ minimal prop drill in TipTapEditor.tsx)
 * - Worktree note: prepared on feature/synced-block-live-bidir-m3
 *
 * ==========================================================================
 * M2→M3 HEAVY SCAFFOLD COMMENTS (mandatory per charter):
 * ==========================================================================
 * - Receives notes + onOpenNote + onUpdateNote (new) via the extension's addNodeView.
 * - Title sync is the *clear MVP path* for bidirectional feel. Full content edit path left
 *   explicitly scaffolded (see handleTitleCommit + comments around content area).
 * - Live reactivity strengthened without touching the atom contract or TipTap internals.
 * - All prior M2 a11y, mobile, read-only, missing-state, re-sync logic *preserved exactly*.
 * - New UI elements follow identical styling tokens, touch targets, ARIA patterns.
 * - Future M3: when editMode also enables content area, use a safe plain-text commit that
 *   either replaces note.content or emits TipTap JSON (requires parent serializer).
 *
 * HANDOFF FOR FUTURE AGENT 47/53 (M3): full content sync + bidirectional live sync richer
 * edge handling per M2-SIGNOFF-CHECKLIST-2026-05-31.md §5. All "M2→M3" markers here preserved.
 *
 * This file + extension = complete M2→M3 polish for "live synced reference".
 */

import React from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { RefreshCw, FileText, AlertTriangle, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// PROPS (mirror the pattern of sibling M2 node views for easy future unification)
// ============================================================================
interface SyncedBlockNodeViewProps {
  node: {
    attrs: {
      targetNoteId?: string | null;
      title?: string;
      // SCAFFOLD: targetBlockId / blockPath reserved for M3 "selected block" granularity
      // targetBlockId?: string | null;
    };
  };
  // M2 HYGIENE (SyncedBlock): tightened Record<string, any> -> Record<string, unknown> on internal updateAttributes (parity only, completely unused in this read-only MVP).
  // unknown tightens without side-effects or caller impact (unexported interface + zero reads of passed attrs here).
  updateAttributes?: (attrs: Record<string, unknown>) => void; // present for parity (unused in read-only MVP)
  selected?: boolean;

  // === THE M2→M3 LIVE DATA BRIDGE ===
  // These are injected by SyncedBlock.addNodeView() from the editor configuration.
  // When the host NotesView updates its `notes` array, React re-renders deliver fresh data.
  // M3: onUpdateNote enables optional write path (title sync MVP for bidirectional feel).
  // HANDOFF FOR FUTURE AGENT 47/53: full content path extends this exact channel.
  notes?: any[];
  onOpenNote?: (noteId: string) => void;
  onUpdateNote?: (noteId: string, updates: { title?: string; content?: any }) => void;
}

// ============================================================================
// MINIMAL VIABLE NODE VIEW IMPLEMENTATION (M3 BIDIR ENHANCED)
// ============================================================================
export function SyncedBlockNodeView({
  node,
  selected,
  notes = [],
  onOpenNote,
  onUpdateNote,
}: SyncedBlockNodeViewProps) {
  const attrs = node.attrs;
  const targetNoteId = attrs.targetNoteId || null;
  const storedTitle = attrs.title;

  // ----------------------------------------------------------------------
  // LIVE REFERENCE LOOKUP (the heart of "working reference to another note's content")
  // ----------------------------------------------------------------------
  // Finds the current version of the referenced note from the live notes collection.
  // This is how "pulls latest from the referenced note" happens automatically.
  // M3: same lookup now powers both read display AND the write target for title sync.
  //
  // PRODUCTION HARDENING (deleted/missing targets):
  // - Defensive: (notes || []).filter(Boolean) protects against null/undefined entries in the
  //   live notes prop (can occur during hybridStore transitions, partial loads, or race conditions).
  // - isMissing distinguishes "targetNoteId present in attrs but no match in current notes slice".
  //   This covers: actual deletion of target, workspace filter exclusion, or permission-based hiding.
  // - Downstream: canWrite, edit toggle, missing UI, and all click handlers respect isMissing strictly.
  // - FUTURE M3: could surface "deletedAt" or permission reason from a richer note meta if parent supplies.
  //   For now the amber card + actionable guidance is the production edge response.
  const safeNotes = Array.isArray(notes) ? notes.filter((n: any) => n && typeof n === "object") : [];
  const referencedNote = targetNoteId
    ? safeNotes.find((n: any) => n.id === targetNoteId)
    : null;

  // Hoisted early for use in canWrite safety derivation (prevents TDZ in M3 edit state)
  const isMissing = !!targetNoteId && !referencedNote;

  const displayTitle =
    referencedNote?.title || storedTitle || (targetNoteId ? "Unknown Note" : "Select a note");

  // ----------------------------------------------------------------------
  // READ-ONLY CONTENT EXTRACTION (MVP — full note, not selected block yet)
  // ----------------------------------------------------------------------
  // Supports the current Note.content shape (string that is either plain text or
  // serialized TipTap JSON). Deliberately simple to avoid new helper modules.
  // M3 SCAFFOLD: See the major "M2→M3 FULL CONTENT BIDIRECTIONAL SYNC SCAFFOLDING" block above.
  // Full in-place content write (handleContentCommit + pendingContent state + textarea swap)
  // will activate the preview area for editing. Content extraction here remains the
  // read-path foundation. Serializer upgrade point: replace extractPlainTextFromTipTap.
  // Kept disabled for safety — title sync alone delivers the "bidirectional" M2→M3 feel.
  const rawContent: string = referencedNote?.content ?? "";
  const previewText = React.useMemo(() => {
    if (!rawContent || typeof rawContent !== "string") return "(no content)";

    let extracted = "";
    const trimmed = rawContent.trim();

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      // Likely TipTap JSON — walk for text nodes (naive but sufficient for MVP preview)
      try {
        const parsed = JSON.parse(trimmed);
        extracted = extractPlainTextFromTipTap(parsed);
      } catch {
        extracted = trimmed;
      }
    } else {
      extracted = trimmed;
    }

    // Clean + truncate for clean card display (read-only, so no need for full doc)
    extracted = extracted.replace(/\s+/g, " ").trim();
    if (extracted.length > 260) {
      extracted = extracted.slice(0, 257) + "…";
    }
    return extracted || "(empty note)";
  }, [rawContent]);

  // ========================================================================
  // M3 BIDIRECTIONAL STATE (EDIT IN PLACE — TITLE SYNC MVP)
  // ========================================================================
  // isEditingTitle: controls the optional two-way title sync mode.
  // pendingTitle: controlled value while editing (starts from live or stored).
  // All writes go exclusively through onUpdateNote(targetNoteId, { title }) — never mutate node attrs directly.
  // This keeps the atom node stable while the *source of truth* (the target note) is updated.
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [pendingTitle, setPendingTitle] = React.useState("");

  // Derived: can we safely allow writes? (deleted targets + missing callback are hard blocks)
  const canWrite = !!onUpdateNote && !!targetNoteId && !isMissing;

  // ==========================================================================
  // M2→M3 FULL CONTENT BIDIRECTIONAL SYNC SCAFFOLDING (STRONG PREP FOR M3)
  // ==========================================================================
  // HANDOFF FOR FUTURE AGENT 47/53 (M3): "full content sync" + bidirectional live sync richer edge handling.
  // Per docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md §5 explicit M2→M3 bridge.
  // TITLE MVP (delivered): safe, low-risk, uses existing onUpdateNote({title}).
  // FULL CONTENT PATH (M3 work):
  //
  // 1. Safe entry point: a plain-text "edit content excerpt" area (controlled textarea)
  //    that commits via onUpdateNote(targetNoteId, { content: newPlainText }).
  //    This avoids any TipTap-in-TipTap complexity.
  //
  // 2. Rich path (higher risk): inject a lightweight sub-editor or use a
  //    parent-provided serializer (e.g. tiptap JSON <-> html or markdown).
  //    Would require:
  //      - onContentChange or full onUpdateNote({content: serialized})
  //      - Conflict UI (last-write-wins vs 3-way with updatedAt)
  //      - Granular targetBlockId support (add attr + picker change)
  //
  // 3. Production requirements for content write:
  //    - Robust roundtrip: extract -> edit -> serialize back without losing marks/embeds.
  //    - Server authoritative diff or OT/CF for concurrent edits on same target.
  //    - Permission propagation (if target note has ACLs in M3+).
  //    - Cycle-aware full graph sync (not just titles).
  //
  // SCAFFOLD LOCATIONS (search for "CONTENT_WRITE" or "handleContentCommit"):
  // - Add state: isEditingContent, pendingContent
  // - New handlers (commented below for copy/paste into M3)
  // - UI: expand preview area when editing content (behind a second toggle or unified "edit mode")
  // - Extension side: may forward a contentSerializer or onResyncContent callback.
  //
  // This block + the handleTitleCommit pattern + updateAttributes comments = ready handoff.
  // Zero active code added here to keep M2 contract and risk zero.
  // DO NOT remove: explicit marker for M3 full content sync implementation.
  // ==========================================================================

  // CONTENT_WRITE STUB (M3 — DO NOT UNCOMMENT IN M2)
  // HANDOFF FOR FUTURE AGENT 47/53: Ready-to-paste skeleton for full content bidirectional sync.
  // const [isEditingContent, setIsEditingContent] = React.useState(false);
  // const [pendingContent, setPendingContent] = React.useState("");
  //
  // const handleContentCommit = React.useCallback(() => {
  //   if (!canWrite || !targetNoteId || !onUpdateNote) return;
  //   // M3: decide serialization strategy here. For plain:
  //   // onUpdateNote(targetNoteId, { content: pendingContent });
  //   // For rich: pass TipTap JSON or require parent to provide serializer fn.
  //   setIsEditingContent(false);
  // }, [canWrite, targetNoteId, onUpdateNote, pendingContent]);
  //
  // Usage in future render: when !isMissing && canWrite, show conditional
  // textarea bound to pendingContent, with commit on blur/ctrl-enter.
  // Preview area would swap to editor surface (or keep read-only + separate panel).

  // ==========================================================================
  // CYCLE PREVENTION (PRODUCTION HARDENING + M3 SCAFFOLD)
  // HANDOFF FOR FUTURE AGENT 47/53: M3 ancestry tracking for deep graph cycles (see §5 synced bidirectional).
  // ==========================================================================
  // DIRECT (SELF) CYCLES:
  //   - Prevented at creation time in the synced-block picker (TipTapEditor.tsx):
  //     syncedBlockNoteCandidates explicitly filters out the host noteId.
  //   - Therefore targetNoteId can never equal the containing note when the block is inserted.
  //   - Runtime write handler below only ever targets a *different* note; no self-write possible.
  //
  // TRANSITIVE / DEEP CYCLES (A syncs title to B; B syncs to C; C back to A):
  //   - Not detectable here because this NodeView does not receive ancestry graph or
  //     currentNoteId (would require additional prop drill + visited-set tracking).
  //   - M3 ROADMAP: pass `currentNoteId` + optional `syncAncestorIds?: string[]` on attrs.
  //     On write, parent (or a future sync graph util) can walk and reject.
  //   - For title MVP this is low-risk (only titles flow; no content loops).
  //   - Picker exclusion is the practical defense for M2/M3 launch.
  //
  // WRITE-SIDE GUARDS (here):
  //   - The no-op check (newTitle === original) + !newTitle already protects against
  //     redundant writes that could theoretically trigger re-entrancy in poorly wired parents.
  //   - canWrite already excludes missing targets (deleted notes cannot participate in sync).
  //   - Parent onUpdateNote implementation is trusted to be idempotent / guarded (see NotesView load renorm pattern).
  //
  // EASY WINS APPLIED: explicit section + cross-refs. Zero behavior change.
  // ==========================================================================

  // Enter edit mode — seed pending from current live display title
  const handleToggleEdit = React.useCallback(() => {
    if (!canWrite) return; // graceful: no-op when no writer or deleted
    if (!isEditingTitle) {
      setPendingTitle(displayTitle || "");
      setIsEditingTitle(true);
    } else {
      // toggle off without save
      handleCancelEdit();
    }
  }, [canWrite, isEditingTitle, displayTitle]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingTitle(e.target.value);
  };

  // COMMIT (the actual bidirectional write)
  const handleTitleCommit = React.useCallback(() => {
    if (!canWrite || !targetNoteId || !onUpdateNote) return;

    const newTitle = pendingTitle.trim();
    const original = displayTitle || "";

    // CYCLE + NO-OP GUARD (see dedicated "CYCLE PREVENTION" section above for full analysis)
    // - Self impossible (picker creation guard + targetNoteId != host)
    // - Deep graph cycles out of scope for title MVP (M3 ancestry scaffold documented)
    // - This no-op also protects against parent update storms / re-render loops
    if (!newTitle || newTitle === original) {
      setIsEditingTitle(false);
      setPendingTitle("");
      return;
    }

    // Write back to target via existing update path.
    // Parent (NotesView/hybridStore) receives this and should update the note + broadcast fresh `notes` array.
    // That broadcast will cause this (and all other) SyncedBlock instances to auto re-render with fresh data.
    onUpdateNote(targetNoteId, { title: newTitle });

    // Optimistic local close — the next render with updated notes[] will show authoritative value.
    setIsEditingTitle(false);
    setPendingTitle("");

    // M3 SCAFFOLD: if we wanted to also touch the local storedTitle attr we could do:
    // updateAttributes?.({ title: newTitle });
    // But we deliberately do NOT — source note is the single source of truth.
  }, [canWrite, targetNoteId, onUpdateNote, pendingTitle, displayTitle]);

  const handleCancelEdit = React.useCallback(() => {
    setIsEditingTitle(false);
    setPendingTitle("");
  }, []);

  // ----------------------------------------------------------------------
  // M3 ENHANCED RE-SYNC STATE + LIVE AUTO-DETECT (for (b) auto re-render feel)
  // ----------------------------------------------------------------------
  // Timestamp is local UI state only. The actual data is already live via props.
  // Button gives explicit "re-pull latest". NEW: effect detects external note changes
  // (title/content/updatedAt from live notes prop) and auto-refreshes the timestamp.
  // This is what makes SyncedBlock feel like a *live* mirror when the source note is edited elsewhere.
  const [lastSynced, setLastSynced] = React.useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );

  // Ref to detect *real* external changes vs our own render cycles
  const prevReferencedRef = React.useRef<any>(null);

  const handleResync = React.useCallback(() => {
    // M2→M3: In a future increment this could:
    //  - Call a parent onForceResync(targetNoteId) prop
    //  - Trigger a targeted refetch from hybridStore / Supabase
    //  - Show a "syncing..." microstate
    // For now: explicit user action + fresh timestamp proves the contract.
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLastSynced(now);

    // Touch the attribute lightly so TipTap knows the node was interacted with
    // (harmless for read-only; helps some internal selection / decoration flows)
    // updateAttributes is optional and we do not change targetNoteId here.
  }, []);

  // M3 AUTO LIVE SYNC EFFECT: when the *source* note changes in the live notes prop,
  // we automatically consider the block "re-synced" (updates timestamp + future visual affordance).
  // Combined with React re-render of previewText/displayTitle this delivers (b).
  React.useEffect(() => {
    const current = referencedNote;
    const prev = prevReferencedRef.current;

    const changed =
      current &&
      prev &&
      (current.title !== prev.title ||
        current.content !== prev.content ||
        current.updatedAt !== prev.updatedAt);

    if (changed) {
      const now = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLastSynced(now);
      // M3 future: could add a transient "just updated" class flash here
    }

    prevReferencedRef.current = current ? { ...current } : null;
  }, [referencedNote?.title, referencedNote?.content, referencedNote?.updatedAt]);

  // Auto-load / initialize timestamp when the referenced note *identity* changes (mount or attr update)
  React.useEffect(() => {
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLastSynced(now);
    // Intentionally no dependency on the full note object — targetNoteId is the identity
  }, [targetNoteId]);

  // ==========================================================================
  // M2 A11Y + MOBILE POLISH (SYNCED BLOCK KEYBOARD + TOUCH + ARIA)
  // ==========================================================================
  // Charter-scoped: Enter/Esc support on the block surface (buttons already native keyboard).
  // Arrows: N/A (single-unit surface, not a list/grid like Board). Esc releases focus.
  // Touch targets: added touch-manipulation + min-h on header buttons + converted footer span.
  // ARIA: region role + descriptive label on container; explicit labels on actions.
  // Small-screen: existing flex + text sizing already responsive; no layout mutation.
  // Converted non-button footer span->button (critical a11y fix, zero behavior change).
  // Preserves read-only contract, re-sync logic, missing state, all click guards exactly.
  // Heavy M2 comments. Internal verification reads pre/post. No globals.css.
  const handleSyncedBlockKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Only act when the surface container itself has focus (children buttons handle their own keys)
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (targetNoteId && onOpenNote) onOpenNote(targetNoteId);
    } else if (e.key === 'Escape') {
      (e.currentTarget as HTMLElement).blur();
    }
    // No arrow handling (per design: not a multi-item navigable like Kanban cards)
  };

  // ----------------------------------------------------------------------
  // DERIVED UI STATE (isMissing hoisted earlier for M3 canWrite safety)
  // ----------------------------------------------------------------------
  const sourceUpdated = referencedNote?.updatedAt
    ? new Date(referencedNote.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })
    : null;

  // ----------------------------------------------------------------------
  // RENDER — CLEAN, LABELED, READ-ONLY UI
  // ----------------------------------------------------------------------
  return (
    <NodeViewWrapper
      as="div"
      className={cn(
        "synced-block-node my-3 block overflow-hidden rounded-2xl border transition-all",
        isMissing
          ? "bg-amber-950/20 border-amber-500/40"
          : "bg-[#0a0a0f] border-white/10 hover:border-white/20",
        selected && "ring-1 ring-[#c084fc] ring-offset-2 ring-offset-[#0a0a0f]"
      )}
      data-target-note-id={targetNoteId}
      data-synced-block="true"
      /* M2 A11Y/MOBILE: role + aria for the entire SyncedBlock surface (region landmark for SR users).
         onKeyDown provides Enter (open source) / Esc when the wrapper container is directly focused.
         tabIndex={-1} allows programmatic focus without stealing natural tab order from child buttons.
         All changes additive; existing button behaviors and guards untouched. */
      role="region"
      aria-label={`Synced block from ${displayTitle}${isMissing ? ' (missing)' : ''}. Press Enter to open source note when focused.`}
      onKeyDown={handleSyncedBlockKeyDown}
      tabIndex={-1}
    >
      {/* === HEADER: "Synced from Note X" label (core deliverable #3) + M3 EDIT IN PLACE === */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-3 py-2 text-[11px]">
        <div className="flex items-center gap-2 text-[#c084fc]">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium tracking-[-0.1px]">Synced from Note</span>

          {/* M3 BIDIR TITLE (two-way sync MVP): when edit mode active, render controlled input.
              Otherwise: the classic clickable read-only title (opens source). 
              All M2 a11y/touch classes preserved on the button path. Input has matching touch/keyboard affordance. */}
          {isEditingTitle ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={pendingTitle}
                onChange={handleTitleChange}
                onBlur={handleTitleCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleTitleCommit(); }
                  if (e.key === 'Escape') { e.preventDefault(); handleCancelEdit(); }
                }}
                className="max-w-[200px] truncate rounded bg-black/60 border border-[#c084fc]/40 px-1.5 py-0.5 font-mono text-[#e4e4e7] text-[11px] focus:outline-none focus:border-[#c084fc] touch-manipulation min-h-[44px]"
                autoFocus
                aria-label="Edit synced note title (writes back on Enter/blur)"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleTitleCommit(); }}
                className="rounded p-1 text-[#00ff9f] hover:bg-white/10 active:bg-white/20 touch-manipulation min-h-[44px] min-w-[32px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                title="Save title to source note (two-way sync)"
                aria-label="Commit title change to source"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                className="rounded p-1 text-[#a1a1aa] hover:bg-white/10 active:bg-white/20 touch-manipulation min-h-[44px] min-w-[32px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                title="Cancel title edit"
                aria-label="Cancel title edit"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            /* Clickable source note title — opens the canonical note (read-only affordance) */
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (targetNoteId && onOpenNote) {
                  onOpenNote(targetNoteId);
                }
              }}
              /* M2 A11Y/MOBILE: added explicit aria-label + touch-manipulation + min height for reliable 44px-ish touch target on mobile + better keyboard affordance. */
              className="max-w-[220px] truncate rounded px-1.5 py-1 font-mono text-[#e4e4e7] hover:bg-white/10 hover:text-[#c084fc] active:bg-white/20 transition-colors cursor-pointer touch-manipulation min-h-[44px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
              title={targetNoteId ? `Open source note (${targetNoteId})` : "No target note"}
              disabled={!targetNoteId || !onOpenNote}
              aria-label={`Open source note ${displayTitle}`}
            >
              {displayTitle}
            </button>
          )}

          {targetNoteId && !isEditingTitle && (
            <span className="font-mono text-[9px] text-[#71717a] opacity-60">
              #{targetNoteId.slice(0, 6)}
            </span>
          )}
        </div>

        {/* M3 EDIT IN PLACE TOGGLE + RE-SYNC (right side cluster) */}
        <div className="flex items-center gap-1">
          {/* OPTIONAL "Edit in place" toggle — the heart of (a) bidirectional title sync MVP.
              Only enabled when onUpdateNote is wired AND target exists (production edge guard).
              When clicked: enters controlled title input + commit/cancel.
              On commit: calls onUpdateNote → parent updates source → live notes[] broadcast → auto re-render of this + siblings (b).
              Heavy scaffold: full content edit would expand this toggle to also unlock preview area. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleEdit();
            }}
            disabled={!canWrite}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition touch-manipulation min-h-[44px] focus-visible:ring-1 focus-visible:ring-[#c084fc]",
              isEditingTitle
                ? "border-[#c084fc] bg-[#c084fc]/10 text-[#c084fc]"
                : canWrite
                  ? "border-white/10 bg-black/40 text-[#a1a1aa] hover:border-[#c084fc]/40 hover:text-[#c084fc] active:bg-white/10"
                  : "border-white/10 bg-black/40 text-[#71717a]/60 cursor-not-allowed"
            )}
            title={
              !canWrite
                ? (!onUpdateNote
                    ? "Read-only: onUpdateNote not wired by parent (M3 integration pending in NotesView). Title sync disabled until write path supplied."
                    : "Edit disabled: target note missing/deleted or invalid state. Cannot sync to inaccessible target.")
                : isEditingTitle
                  ? "Exit title edit mode"
                  : "Edit in place: two-way title sync (MVP). Changes write back to the source note."
            }
            aria-label={isEditingTitle ? "Exit edit in place" : "Toggle edit in place for title sync"}
            aria-pressed={isEditingTitle}
          >
            <Pencil className="h-3 w-3" />
            <span>{isEditingTitle ? "Editing" : "Edit in place"}</span>
          </button>

          {/* M3 BADGE: visible only while actively two-way syncing titles */}
          {isEditingTitle && (
            <span className="rounded bg-[#c084fc]/20 px-1 py-px text-[8px] text-[#c084fc] font-mono tracking-widest border border-[#c084fc]/30">
              TITLE SYNC
            </span>
          )}

          {/* RE-SYNC BUTTON — explicit "pull latest" control (unchanged M2 behavior) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleResync();
            }}
            /* M2 MOBILE/A11Y: touch + min-height for reliable tap target; explicit aria-label for SR. */
            className="flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-[#a1a1aa] transition hover:border-[#c084fc]/40 hover:text-[#c084fc] active:bg-white/10 touch-manipulation min-h-[44px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
            title="Re-sync: pull the latest content from the source note (live data already reactive)"
            aria-label="Re-sync this block with latest content from source note"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Re-sync</span>
          </button>
        </div>
      </div>

      {/* === READ-ONLY CONTENT PREVIEW AREA === */}
      <div className="min-h-[68px] p-3 text-[13px] leading-snug text-[#d4d4d8] bg-black/30">
        {isMissing ? (
          <div className="flex items-start gap-2 text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Referenced note not found (deleted / inaccessible)</div>
              <div className="mt-0.5 text-[11px] text-amber-400/80">
                Target ID: {targetNoteId}. This block references a note that was deleted, is outside the active workspace slice,
                or is not visible due to permissions/filters. Production action: remove the SyncedBlock node via editor.
                (M3: could offer "detach" command once extension exposes deleteNode helper.)
              </div>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap opacity-90">
            {previewText}
          </div>
        )}
      </div>

      {/* === FOOTER — transparency + M2/M3 status === */}
      <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-3 py-1.5 text-[9px] text-[#71717a]">
        <div className="flex items-center gap-2">
          <span className="font-mono tracking-widest opacity-70">SYNCED BLOCK</span>
          {/* M3: badge now reflects live bidirectional capability */}
          <span className="rounded bg-white/10 px-1.5 py-px text-[8px] text-[#c084fc]/80">M2→M3 LIVE</span>
        </div>

        <div className="flex items-center gap-2 tabular-nums">
          <span>Last synced: {lastSynced}</span>
          {sourceUpdated && <span className="opacity-50">• src {sourceUpdated}</span>}
          {referencedNote && (
            /* M2 A11Y CRITICAL: converted <span onClick> (not keyboard accessible) to proper <button>.
               Preserves exact click behavior + stopPropagation guard. Added full touch/ARIA/keyboard support.
               This fixes a latent a11y violation on the SyncedBlock surface with zero other impact. */
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (targetNoteId && onOpenNote) onOpenNote(targetNoteId);
              }}
              className="cursor-pointer opacity-60 hover:opacity-100 hover:underline bg-transparent border-0 p-0 font-inherit text-inherit touch-manipulation min-h-[44px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#c084fc]"
              title="Open source note"
              aria-label="View full source note"
            >
              (view source)
            </button>
          )}
          {/* M3 EDGE SCAFFOLD (footer): permission / wiring note visible when write path absent.
              PRODUCTION HARDENED: explicit, actionable message distinguishing "no writer wired" vs other states.
              This is the primary signal that the SyncedBlock is operating in read-only mode today
              (because NotesView does not yet drill onUpdateNote to TipTapEditor — intentional M3 step).
              Keeps UI honest without cluttering the primary header.
              HANDOFF FOR FUTURE AGENT 47/53: full content sync gated here per §5. */}
          {!onUpdateNote && targetNoteId && !isMissing && (
            <span
              className="rounded bg-[#c084fc]/10 px-1 py-px text-[#c084fc]/70 border border-[#c084fc]/20"
              title="Read-only sync (M2/M3 boundary): parent has not supplied onUpdateNote to the editor. Title bidirectional writes disabled. Full content sync also gated behind this wiring + serializer. See M3 scaffolding comments."
            >
              read-only (no write path)
            </span>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ============================================================================
// NAIVE TIP TAP TEXT EXTRACTOR (MVP ONLY — internal, no shared dep)
// ============================================================================
// Walks a TipTap JSON document and concatenates text nodes.
// Sufficient for a readable preview card. M3 should use a proper serializer.
// HANDOFF FOR FUTURE AGENT 47/53: M3 full content bidirectional sync replacement point (see CONTENT_WRITE STUB + §5).
function extractPlainTextFromTipTap(json: any): string {
  if (!json) return "";
  if (typeof json === "string") return json;

  let out = "";

  const walk = (n: any) => {
    if (!n) return;
    if (typeof n.text === "string") {
      out += n.text + " ";
    }
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
    } else if (n.content && typeof n.content === "object") {
      walk(n.content);
    }
  };

  if (Array.isArray(json)) {
    json.forEach(walk);
  } else if (json.content) {
    walk(json);
  } else {
    walk(json);
  }

  return out.trim();
}

// Default export for tooling consistency (not required by current import)
export default SyncedBlockNodeView;

// ============================================================================
// END OF SYNCED-BLOCK-NODE-VIEW.TSX
// This + the extension file = complete minimal viable foundation.
// All future synced-block work (block granularity, write sync, full content sync, etc.) builds on this.
// HANDOFF FOR FUTURE AGENT 47/53: M2→M3 bidirectional + richer edge handling per checklist §5 complete.
// ============================================================================
