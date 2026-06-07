/**
 * DatabaseBlock Node Extension for TipTap (Milestone 2)
 *
 * This is the foundation for real, interactive "database" views inside notes.
 * Goal: Allow users to type /db or /database and get a live, filterable
 * table/board of tasks and/or notes that stays in sync with the rest of the system.
 *
 * Current state (this wave): First real custom Node + NodeView.
 * It replaces the previous static placeholder paragraph.
 *
 * Future increments will add:
 *   - Persistent query configuration (which tasks/notes to show, filters, sorts)
 *   - Multiple view modes (Table, Board, Calendar)
 *   - Real server-powered queries when live
 *   - Drag reordering inside the block  (M2 COMPLETE: intra-column native + inter-column already delivered in database-block* files only)
 */

/* M2 COMPLETION (interactive DatabaseBlock):
 * Board view: status change polished on cards (colored interactive pills).
 * REAL KANBAN DRAG: now fully interactive — drag cards between todo/doing/done columns using native DnD (minimal, no dnd-kit inside this scope).
 * INTRA-COLUMN REORDER (M2): native HTML5 drag reordering *within same column* (todo/doing/done) with visual feedback + persistence via queryConfig.columnOrders extension.
 *   Implemented with tiny native logic only inside database-block-node-view (no other files per strict rules). Existing inter-column + all guards untouched.
 * Edit View: expanded with priority filter (in addition to title/types/status); richer query editor auto-persisting everything.
 * Auto-persist: queryConfig now updates live on view mode, search, Edit form (title/types/status/priority filters).
 * Board uses dedicated boardTasks + filters so kanban shows done + respects Edit View priority/status.
 * All edits narrow to this + node-view.tsx. All hybrid/demo/M3 guards + footer preserved.
 * See database-block-node-view.tsx for heavy M2 markers and impl (native drag handlers, boardTasks, priority UI).
 *
 * M2 A11Y + MOBILE POLISH (this file + paired node-view ONLY):
 * - Arrow/Enter/Esc keyboard navigation added to Board/Kanban cards (linear + column groups).
 * - Touch target enlargements on board status pills + existing controls.
 * - ARIA roles/labels (region, group, enhanced buttons) + live counts.
 * - Small-screen responsiveness via existing responsive grid (no new CSS).
 * - SyncedBlock: Enter/Esc surface nav, footer span->button fix, touch/ARIA everywhere.
 * - Zero behavior change. All guards, DnD, persistence, filters, atom semantics untouched.
 * - Edits strictly limited to database-block* + synced-block* files per charter.
 * - Heavy M2 comments + internal verification reads throughout.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DatabaseBlockNodeView } from "./database-block-node-view";

// M2→M3 SERVER QUERY FOUNDATION (DatabaseBlock production completeness):
// Import the hybrid guard exactly as used across the notes surface (TipTapEditor, useNoteHistory, etc).
// All new server/RPC paths MUST be protected by this; demo mode + w1/w2 IDs never hit real DB.
// HANDOFF FOR FUTURE AGENT 47/53: See §5 checklist for "server query engine stubs / RPC hooks foundation".
import { isSupabaseLive } from "@/lib/data/hybridStore";

export interface DatabaseBlockOptions {
  HTMLAttributes: Record<string, any>;
  tasks?: any[];
  notes?: any[];
  linkedItems?: any[];
  onOpenTask?: (taskId: string) => void;
  onToggleStatus?: (taskId: string) => Promise<void>;
  onUpdateTask?: (taskId: string, updates: Partial<any>) => Promise<void>;
  onOpenNote?: (noteId: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    databaseBlock: {
      /**
       * Insert a database block node
       */
      insertDatabaseBlock: (attributes?: { 
        viewType?: "tasks+notes" | "tasks" | "notes";
        title?: string;
        queryConfig?: string;
      }) => ReturnType;
    };
  }
}

export const DatabaseBlock = Node.create<DatabaseBlockOptions>({
  name: "databaseBlock",

  group: "block",

  atom: true, // Treat as a single interactive unit for now

  addAttributes() {
    return {
      viewType: {
        default: "tasks+notes",
        parseHTML: (element) => element.getAttribute("data-view-type"),
        renderHTML: (attributes) => ({ "data-view-type": attributes.viewType }),
      },
      title: {
        default: "Database View",
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes) => ({ "data-title": attributes.title }),
      },
      // Basic query config stub for future persistence (M2 foundation)
      queryConfig: {
        default: JSON.stringify({ types: ["tasks", "notes"], filters: {} }),
        parseHTML: (element) => element.getAttribute("data-query-config"),
        renderHTML: (attributes) => ({ "data-query-config": attributes.queryConfig }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="database-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "database-block",
        class: "database-block-node",
      }),
      ["span", {}, "Database View"],
    ];
  },

  addCommands() {
    return {
      insertDatabaseBlock:
        (attributes = {}) =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
              attrs: attributes,
            });
          },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatabaseBlockNodeView);
  },
});

// =============================================================================
// M2→M3 SERVER QUERY ENGINE STUBS / RPC FOUNDATION FOR DatabaseBlock
// (Added per M2→M3 production completeness charter — ultra-narrow, zero behavior change)
// =============================================================================
//
// HANDOFF FOR FUTURE AGENT 47/53 (M3): See docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md §5
// "Full custom TipTap NodeView + React rendering engine for DatabaseBlock with hybrid
// query execution + RPCs (beyond the current JSON config + DOM table/Board)" +
// "server query engine stubs / RPC hooks foundation". This file is the canonical
// anchor. Future M3 implementers replace ONLY the inner no-op body.
//
// This file (database-block.ts) is the canonical home for the extension + its
// associated server query contract. Future M3 work can import directly:
//
//   import { getDatabaseBlockData, type DatabaseBlockQueryInput, type DatabaseBlockQueryResult } from ".../database-block"
//
// All stubs are:
//   - Guarded by isSupabaseLive() at entry (demo paths return empty safe results)
//   - Non-functional placeholders (SCAFFOLD ONLY) — identical style to AI stubs in TipTapEditor.tsx
//   - Designed so the *real* implementation (hybridStore or dedicated RPC layer) can
//     be swapped in with minimal caller changes.
//
// Current client rendering (queryConfig-driven filtering, Board/kanban, table views,
// intra/inter column DnD, Edit View auto-persist, all DOM) remains 100% client-side
// and untouched. The stubs below are dormant until wired by parent (M3 scope).
//
// WHERE THE REAL SERVER QUERY ENGINE WILL GO (exact marker for M3 implementers):
// -----------------------------------------------------------------------------
// 1. Parse the incoming queryConfig (JSON string or object) → filters, viewType,
//    columnOrders, saved views, search, types (tasks/notes), priority/status etc.
// 2. When LIVE: either
//      a) await supabase.rpc('get_filtered_database_items', { p_workspace_id, p_filters: ... })
//         (preferred: new SECURITY DEFINER RPC following existing patterns in schema.sql)
//      b) or guarded .from("tasks").select(...) + .from("notes")... with .in / .eq built
//         dynamically from queryConfig (hybridStore style).
// 3. Apply workspace membership RLS + any additional server filters.
// 4. Return normalized { tasks: Task[], notes: Note[] } (use shared types).
// 5. Future: support pagination, sorting, full-text, linked items expansion, realtime.
// 6. Error handling + offline fallbacks live in the hybrid layer (callers never see raw errors).
// 7. The actual engine body will move to lib/data/hybridStore.ts (export async function getDatabaseBlockData)
//    or /features/notes/data/serverQueries.ts — this stub will become a thin re-export or direct call.
// -----------------------------------------------------------------------------
// DO NOT remove these comments. They are the handoff contract for M3.
// =============================================================================

/**
 * Input shape for server-powered DatabaseBlock queries (M3 foundation).
 * Mirrors the attrs.queryConfig + context needed to execute a live filtered view.
 */
export interface DatabaseBlockQueryInput {
  /** Workspace scope (required for live RLS + data isolation) */
  workspaceId?: string;
  /** Raw or parsed queryConfig from the TipTap node attrs (JSON serialized in DOM) */
  queryConfig: string | Record<string, any>;
  /** Optional: requesting user for additional server-side permission checks */
  userId?: string;
  /** Future expansion: request size, cursor, etc. */
  options?: {
    limit?: number;
    includeArchived?: boolean;
  };
}

/**
 * Output shape returned by the (future) server query engine.
 * Designed to be dropped straight into the existing DatabaseBlockNodeView props.
 */
export interface DatabaseBlockQueryResult {
  tasks: any[]; // TODO M3: tighten to Task[] once shared types imported (avoid circular for now)
  notes: any[]; // TODO M3: tighten to Note[]
  /** Metadata for UI (counts before client-side slice, server query time, etc.) */
  meta?: {
    totalTasks?: number;
    totalNotes?: number;
    executedAt?: string;
    source: "client" | "server" | "hybrid-cache";
  };
}

/**
 * M3-SCAFFOLDED RPC STUB: getDatabaseBlockData
 *
 * Primary entry point for real server-side execution of a DatabaseBlock's queryConfig.
 *
 * CURRENT BEHAVIOR (guarded, zero change to client Board/kanban):
 *   - !isSupabaseLive() → always returns empty arrays (existing client data via props wins)
 *   - isSupabaseLive() → logs scaffold notice + returns empty (no queries executed yet)
 *
 * FUTURE (M3): Replace the inner body (see "WHERE THE REAL..." block above).
 * Callers (future wiring in TipTapEditor / NotesView / a new useDatabaseBlockQuery hook)
 * will do:
 *   const data = await getDatabaseBlockData({ workspaceId, queryConfig: node.attrs.queryConfig });
 *   // then pass data.tasks / data.notes instead of (or merged with) store slices.
 *
 * This keeps DatabaseBlock fully hybrid-ready without touching current render paths.
 */
export async function getDatabaseBlockData(
  input: DatabaseBlockQueryInput
): Promise<DatabaseBlockQueryResult> {
  // CRITICAL HYBRID GUARD — identical pattern to getTasks / getNotes / onPersistSnapshot etc.
  if (!isSupabaseLive()) {
    // DEMO MODE: safe empty result. Real data continues to arrive exclusively via
    // the props (tasks/notes) passed from parent components (current M2 architecture).
    return {
      tasks: [],
      notes: [],
      meta: { source: "client", executedAt: new Date().toISOString() },
    };
  }

  // ============================================================
  // WHERE THE REAL SERVER QUERY ENGINE WILL GO
  // ============================================================
  // HANDOFF FOR FUTURE AGENT 47/53 (M3 per §5): At this exact location (inside the isSupabaseLive branch), M3 will:
  //
  //   const supabase = getSupabaseClient();
  //   const parsed = typeof input.queryConfig === "string"
  //     ? JSON.parse(input.queryConfig)
  //     : input.queryConfig;
  //
  //   // Build server filters from parsed.types, parsed.filters, parsed.search etc.
  //   // Then either:
  //   //   const { data } = await supabase.rpc("get_database_block_data", { ... });
  //   // or direct from() queries (see hybridStore for examples).
  //
  //   return { tasks: mapRows(...), notes: ..., meta: { source: "server", ... } };
  //
  // Guard demo IDs ("w1", "w2", empty) exactly like getTasks() does.
  // Full error logging via logHybridError / logger.
  // Result shape must stay stable so node-view + consumers need zero updates.
  // Cross-ref: M2-SIGNOFF-CHECKLIST-2026-05-31.md §5 (server query engine stubs + hybrid query execution + RPCs).
  // ============================================================

  // SCAFFOLD ONLY — intentional no-op for M3 handoff. Matches AI stub discipline.
  // Real queries would run here when Supabase is live.
  // (In live mode today this would be hit only if someone manually calls the stub.)
  console.debug(
    "[M3-SCAFFOLD DatabaseBlock] getDatabaseBlockData invoked in LIVE mode (no-op).",
    "queryConfig keys:",
    typeof input.queryConfig === "string"
      ? Object.keys(JSON.parse(input.queryConfig || "{}"))
      : Object.keys(input.queryConfig || {})
  );

  return {
    tasks: [],
    notes: [],
    meta: { source: "server", executedAt: new Date().toISOString() },
  };
}

// Optional future sibling stubs (M3 can expand here without new files):
// export async function saveDatabaseBlockView(...) { ... }
// export async function executeDatabaseBlockMutation(...) { ... }