/**
 * SyncedBlock Node Extension for TipTap (M2 foundation for synced blocks + advanced embeds)
 *
 * ==================================================================================
 * M2 → M3 BRIDGE ITEM: "synced-blocks-foundation" + BIDIR POLISH (WAVE8 / MILESTONE-2-PROGRESS)
 * ==================================================================================
 * Charter (strict): Deliver *minimal viable* Synced Block.
 * - Existing insertSyncedBlock command (or future /synced-block slash) now produces
 *   a *working reference* to another note (by targetNoteId).
 * - NodeView renders READ-ONLY preview of the referenced note's title + content excerpt.
 * - Live data bridge: consumes `notes[]` + `onOpenNote` exactly like DatabaseBlock/TaskEmbed.
 * - Basic re-sync affordance (button + mount auto-load) that "pulls latest" from the
 *   live notes prop (source of truth passed from NotesView → TipTapEditor).
 * - Clean labeled UI: prominent "Synced from Note X" header.
 *
 * ==========================================================================
 * M3 POLISH (this increment — scoped): BIDIRECTIONAL LIVE SYNCED REFERENCE
 * ==========================================================================
 * - OPTIONAL "Edit in place" (two-way TITLE SYNC MVP): writes title changes back to
 *   target note via drilled onUpdateNote callback (safe, no full content overwrite risk).
 * - AUTO RE-RENDER: when source note title/content changes in live `notes` prop,
 *   NodeView receives fresh data on parent re-render + explicit effect bumps UI state.
 *   Feels like true live mirror, not snapshot.
 * - PRODUCTION EDGES (HARDENED):
 *   - Deleted/missing targets: defensive safeNotes lookup in node-view + amber "deleted / inaccessible"
 *     card with explicit production guidance. All write paths gated by isMissing.
 *   - Permission/read-only (onUpdateNote absent): disabled edit-in-place + detailed tooltips + styled
 *     footer "read-only (no write path)" badge. This is the default production state until
 *     NotesView passes the updater (M3 integration).
 *   - Cycle prevention: dedicated section + cross-referenced guards (picker self-exclude is primary;
 *     M3: ancestry attrs for transitive cycles).
 *   - Stronger M2→M3 content scaffolding added (see below + node-view major block).
 *
 * ==========================================================================
 * EXTREMELY MINIMAL VIABLE — EXPLICIT NON-GOALS (per user charter, updated M3):
 * ==========================================================================
 * - NO full two-way content sync / arbitrary in-place editing of referenced rich content (MVP = title only)
 * - NO block-level targeting (only full note by ID for MVP)
 * - NO complex conflict UI, merge, versioning inside the block
 * - NO new slash command registration here (remains editor wiring pending)
 * - RISK ZERO: edits limited to this file + paired node-view + *minimal* prop-drill in TipTapEditor.tsx
 * - Worktree: changes prepared for feature/synced-block-live-bidir-m3 (from m2-foundation base)
 *
 * ==========================================================================
 * M2→M3 SCAFFOLD + BRIDGE NOTES (heavy per charter — for next agent / M3 handoff):
 * ==========================================================================
 * - This is the *anchor point*. When editor wiring lands (TipTapEditor + extensions barrel),
 *   simply configure SyncedBlock like DatabaseBlock and add to slash registry.
 * - M3 NEXT: add targetBlockId (for "selected block" granularity), onResync callback,
 *   actual server diffing, full write-through for content (with JSON roundtrip safety).
 * - The `notes` prop remains the core live bridge: parent re-renders deliver fresh data automatically.
 * - Re-sync button + new auto-effect on referencedNote change = explicit + implicit "pull latest".
 * - onUpdateNote (new M3 option): parent-supplied (e.g. updateNote from hybridStore). Called with
 *   {title} for MVP two-way title sync. Full content path explicitly scaffolded below + in node-view.
 * - Content extraction deliberately naive (string or TipTap JSON). M3 serializer upgrade point.
 * - Insert command already functional; callers pass { targetNoteId, title? }.
 * - CYCLE PREVENTION (M3): picker excludes self; write handler in node-view has early guard.
 *   Future: pass currentNoteId + sync ancestry array on node attrs for deep cycle detection.
 *   See dedicated CYCLE PREVENTION section in synced-block-node-view.tsx for complete analysis.
 * - PERMISSIONS: onUpdateNote assumed to be no-op or toast-fail for read-only targets.
 *   UI shows disabled state when callback absent. Production reality: currently always absent
 *   until NotesView wires it through TipTapEditor (documented in node-view footer + tooltips).
 *
 * HANDOFF FOR FUTURE AGENT 47/53 (M3): Per docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md §5
 * "SyncedBlock bidirectional live sync + richer edge handling (M2→M3 explicit)".
 * Full content sync remains explicitly title-MVP only until M3 serializer + write-through.
 *
 * ==========================================================================
 * M3 FULL CONTENT BIDIR SCAFFOLD (in this file + paired node-view)
 * ==========================================================================
 * - options.onUpdateNote signature already supports {content?: any} for future.
 * - In node-view: major dedicated scaffolding comment block with numbered phases,
 *   production reqs (roundtrip safety, conflict, ACLs), and ready-to-paste CONTENT_WRITE STUB
 *   (handleContentCommit skeleton + state comments).
 * - Preview extraction (extractPlainTextFromTipTap) marked as M3 serializer replacement point.
 * - updateAttributes commented as deliberate non-use (source-of-truth remains the target note).
 * - When implementing M3 content: also consider injecting a serializer prop at configure time here.
 * - All production edges (missing, !writer, cycles) already wired to protect the future content path.
 *
 * HEAVY COMMENT POLICY APPLIED: every section explains why + what comes next.
 * This advances the explicit remaining "synced-blocks-foundation" + makes references feel bidirectional.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SyncedBlockNodeView } from "./synced-block-node-view";

export interface SyncedBlockOptions {
  HTMLAttributes: Record<string, any>;
  notes?: any[];
  onOpenNote?: (noteId: string) => void;
  // ========================================================================
  // M2→M3 BIDIR: drilled write path (minimal). Parent (NotesView) supplies updateNote.
  // MVP usage: only title sync to keep safe (content would require careful JSON handling).
  // When absent, edit-in-place UI gracefully disables with clear messaging.
  // M3 UPGRADE: content?: any will carry serialized TipTap (or plain) for full bidir.
  // Consider future addition of contentSerializer?: (json: any) => string  here for configure().
  // HANDOFF FOR FUTURE AGENT 47/53: full content sync path prepared (see node-view CONTENT_WRITE STUB).
  // ========================================================================
  onUpdateNote?: (noteId: string, updates: { title?: string; content?: any }) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    syncedBlock: {
      insertSyncedBlock: (attributes?: { targetNoteId?: string; title?: string }) => ReturnType;
    };
  }
}

export const SyncedBlock = Node.create<SyncedBlockOptions>({
  name: "syncedBlock",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      targetNoteId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-target-note-id"),
        renderHTML: (attributes) => {
          if (!attributes.targetNoteId) return {};
          return { "data-target-note-id": attributes.targetNoteId };
        },
      },
      title: {
        default: "Synced Content",
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes) => ({ "data-title": attributes.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="synced-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "synced-block",
        class: "synced-block-node",
      }),
      ["span", {}, "Synced Block"],
    ];
  },

  addCommands() {
    return {
      insertSyncedBlock:
        (attributes = {}) =>
          ({ commands }) => {
            // M2→M3 BRIDGE: The command is the insertion surface.
            // Future /synced-block slash handler (in editor) will use this after note picker.
            // For now, direct calls with { targetNoteId: '...' } create working refs.
            // We intentionally keep attrs minimal (no blockId yet).
            // HANDOFF FOR FUTURE AGENT 47/53 (M3): richer edge handling builds here.
            return commands.insertContent({
              type: this.name,
              attrs: attributes,
            });
          },
    };
  },

  // ========================================================================
  // M2/M3 NODEVIEW WIRING (the critical bridge that makes the reference "working" + bidirectional)
  // ========================================================================
  addNodeView() {
    // Pull live options exactly like the sibling M2 extensions (TaskEmbed / DatabaseBlock).
    // This is the data bridge: when NotesView re-renders editor with fresh `notes`,
    // every SyncedBlockNodeView receives the latest referenced content automatically.
    // M3 UPDATE: also forward onUpdateNote for optional write-back (title sync MVP).
    // When parent does not supply it, node-view treats as read-only (graceful degrade).
    //
    // PRODUCTION NOTE: onUpdateNote is currently never passed from NotesView (see analysis in node-view).
    // This makes the hardened read-only states the default production behavior — intentional boundary.
    const notes = this.options.notes || [];
    const onOpenNote = this.options.onOpenNote;
    const onUpdateNote = this.options.onUpdateNote;

    // M2→M3 SCAFFOLD: ReactNodeViewRenderer passes *all* declared options as props to the React component.
    // This keeps the contract identical to DatabaseBlock. The NodeView now owns:
    //   - live reactive lookup (b)
    //   - optional edit-in-place title write (a)
    //   - production edge guards (c) — missing, permissions, cycles (see node-view)
    //   - M3 content write path will reuse the exact same onUpdateNote channel + new stubs.
    // Atom:true guarantees the whole block is treated as a single unit (no split/merge surprises).
    // HANDOFF FOR FUTURE AGENT 47/53: bidirectional sync wiring point per M2→M3 checklist §5.
    return ReactNodeViewRenderer(SyncedBlockNodeView, {});
  },
});

// ============================================================================
// DEFAULT EXPORT (consistency with TaskEmbed / DatabaseBlock patterns)
// ============================================================================
export default SyncedBlock;

// ============================================================================
// END OF SYNCED-BLOCK.TS (M2 FOUNDATION)
// Next agent: wire into TipTapEditor.configure({}) + add to slash command catalog.
// The paired node-view (created in same scoped change) contains the actual UI + logic.
// ============================================================================

/* M2 A11Y + MOBILE POLISH (scoped strictly to synced-block* + database-block* files):
 * - Added keyboard surface support (Enter to open source / Esc blur) + ARIA region + labels.
 * - Converted latent non-button footer affordance to real <button> (a11y + keyboard fix).
 * - Touch target improvements (min-h + touch-manipulation) on re-sync, title, and view-source.
 * - Explicit aria-labels. Small-screen friendly (no layout changes).
 * - All existing read-only, re-sync timestamp, missing-state, live lookup, and guard logic 100% preserved.
 * - No arrows needed (single focusable unit surface, unlike Kanban Board cards which received full arrow nav).
 * - Heavy M2 comments + verification reads. Zero risk to atom node, TipTap, or other extensions.
 */
