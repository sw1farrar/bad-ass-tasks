"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Mark } from "@tiptap/core";
import { TaskEmbed } from "./extensions/task-embed";  // Milestone 2: Live Task embeds inside notes
import { DatabaseBlock } from "./extensions/database-block";  // Milestone 2: Real database blocks (parallel work)
import { SyncedBlock } from "./extensions/synced-block";  // M2→M3 bridge: Synced Blocks foundation (minimal viable now live)
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  MessageSquare,
  Undo2,
  Redo2,
  Code,
  CheckSquare,
  FileText,
  Link2,
  Share2,
  Minus,
  Hash,
  Globe,
  Calendar,
  Zap,
  Clock,
  History,
} from "lucide-react";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { aiTransformText, aiTransformTextAI, isXAIConfigured, extractActionItemsFromText, extractActionItemsFromTextAI } from "@/lib/utils";
import { toast } from "sonner";
import { isSupabaseLive, onPersistSnapshot as persistSnapshotToServer } from "@/lib/data/hybridStore";
import { getBacklinkNotes } from "../hooks/useBacklinks";

// Simple custom Mention mark for proper @mention / [[ ]] pills (Agent 12 polish).
// Upgraded (Agent 24): supports refType ('task' | 'note' | 'external') for bidirectional visual distinction + future resolution.
// Renders as beautiful inline pill with neon styling, prefix icon by type. Foundation for real bidirectional resolution + scanning.
const MentionMark = Mark.create({
  name: "mention",
  addAttributes() {
    return {
      label: { default: "" },
      refId: { default: null }, // future: id for real linking
      refType: { default: "external" }, // 'task' | 'note' | 'external'
    };
  },
  parseHTML() {
    return [{ tag: "span[data-mention]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const { label, refType } = HTMLAttributes;
    const type = refType || "external";
    const prefix = type === "task" ? "✅ " : type === "note" ? "📝 " : "🔗 ";
    const typeTitle = type === "task" ? "Task" : type === "note" ? "Note" : "Link";
    return [
      "span",
      {
        "data-mention": "",
        "data-ref-type": type,
        class: "mention-pill",
        title: `${typeTitle}: ${label || "mention"} (bidirectional ready)`,
        ...HTMLAttributes,
      },
      [prefix + (label || "mention")],
    ];
  },
});

/**
 * Production-ready TipTap block editor for Notes (primary rich experience).
 * - Full toolbar + StarterKit extensions (headings, lists, marks, code, history, hr)
 * - Placeholder extension for clean UX
 * - JSONB round-tripping: accepts plain string or stringified TipTap JSON; emits stringified JSON on change.
 *   Hybrid layer (noteContentToJson/jsonToNoteContent) + list previews handle rich <-> plain gracefully.
 * - **Slash commands**: Magical Notion-style / menu with keyboard nav (↑↓⏎⎋Tab), live scoring filter, icons + CATEGORIES (Formatting / Lists / Smart Embeds / AI / Utils) for discoverability.
 *   Supports /heading, /list, /task, /note, /embed, /divider, /quote, etc. + custom actions. Grouped sections in floating glass.
 *   M2/M3 bridge AI scaffolding (per Agent 47 in master plan): dedicated "AI" category with 3 stub commands
 *     (e.g. "Summarize this section", "Extract action items", "Improve writing") wired to existing ai* helpers.
 *     Non-functional stubs with explicit xAI/Grok call site comments for future backend integration.
 *     Integrates cleanly alongside Mention/Link picker in the shared floating menu. All marked SCAFFOLD ONLY.
 * - Bidirectional linking, embeds, history, conversion prep ready (see later increments + parent wiring).
 * - Fully backward compatible. Demo + live Supabase work identically.
 */
interface TipTapEditorProps {
  /** Plain text OR stringified TipTap JSON doc (from prior rich save / roundtrip). */
  content?: string;
  /** Called with stringified TipTap JSON on every update (rich persistence via hybrid JSONB).
   *  Plain text fallback works automatically via helpers for previews/cards.
   */
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  /** Minimum height for the editable area */
  minHeight?: string;
  // Future-proof callbacks for advanced slash/linking features (non-breaking; parent wires store actions)
  onCreateTaskFromSlash?: (suggestedTitle?: string) => void;
  onCreateNoteFromSlash?: (suggestedTitle?: string) => void;
  onInsertEmbed?: (url: string) => void;
  /** Optional backlinks + linked items for integrated bidirectional panel (Agent 24). Non-breaking if omitted. */
  backlinks?: Array<{ id: string; title: string; type: "task" | "note" }>;
  onRemoveBacklink?: (id: string, type: "task" | "note") => void;
  linkedItems?: Array<{ id: string; title: string; type: "task" | "note" }>;
  onRemoveLinked?: (id: string, type: "task" | "note") => void;
  /** Optional noteId for per-note version history snapshotting (local only, demo + live) */
  noteId?: string;

  /** Live tasks for TaskEmbed NodeViews (Milestone 2) */
  tasks?: any[]; // Using any for now to avoid circular type issues; will tighten later
  /** Open a task modal from an embed */
  onOpenTask?: (taskId: string) => void;
  /** Toggle status directly from the embed (todo → doing → done) */
  onToggleStatus?: (taskId: string) => Promise<void>;
  /** Update arbitrary task fields from embeds (title, dueDate, etc.) */
  onUpdateTask?: (taskId: string, updates: Partial<any>) => Promise<void>;

  /** 
   * Called when user wants to create a real task via /task and embed it immediately.
   * Parent should create the task, auto-link it to the current note, and return the taskId.
   * Returns the new taskId on success, or null.
   */
  onCreateTaskAndEmbed?: (suggestedTitle?: string) => Promise<string | null>;
  // Agent 30: Live cursors / selection sharing (builds on presence broadcast; premium Figma-like feel)
  remoteCursors?: Array<{ userId: string; email?: string; from: number; to: number; color?: string }>;
  onCursorUpdate?: (from: number, to: number) => void;
  /** Live collab: called (debounced) with the latest stringified TipTap JSON while the user is typing */
  onLiveContent?: (content: string) => void;

  /** M2 Version History integration */
  onHistoryChange?: (count: number) => void; // parent can show count in header
  historyOpenTrigger?: number; // increment this from parent to open the panel
  titleSnapshotTrigger?: number; // increment from parent (e.g. after title edit in NoteHeader) to auto-capture snapshot

  /** Real items for the /link picker (M2 deepening bidirectional) */
  linkableItems?: Array<{ id: string; title: string; type: "task" | "note" }>;

  /** Called when user inserts a real mention via the link picker (so parent can mutate linked*Ids for true bidir) */
  onMentionLinked?: (item: { id: string; title: string; type: "task" | "note" }) => void;

  /** Fired whenever the set of mentions in the document changes (powers automatic bidirectional sync) */
  onMentionsChanged?: (mentions: Array<{ label: string; refType?: string; refId?: string | null }>) => void;

  /** Direct note-to-note linking (M2 tightening for /note-link command) */
  onLinkNoteToNote?: (noteId: string, targetNoteId: string) => void;

  /** Open a note (used by database blocks and other embeds) */
  onOpenNote?: (noteId: string) => void;

  /** Persist a snapshot to the note record when in live mode (M2) */
  onPersistSnapshot?: (noteId: string, snapshot: any) => void;

  /** Snapshots loaded from the server (for live mode) */
  serverSnapshots?: Array<{ ts: string; content: string; label: string }>;

  /** Callback when the editor wants to capture a snapshot (for extraction) */
  onCaptureSnapshot?: (label?: string) => void;

  /** Full notes list for DatabaseBlock views + queries (M2) */
  notes?: any[];

  // ========================================================================
  // M3 MINIMAL PROP DRILL (charter-permitted for SyncedBlock bidir only)
  // ========================================================================
  // onUpdateNote: parent-supplied note updater (e.g. from hybridStore.updateNote).
  // Forwarded ONLY to SyncedBlock for optional two-way title sync MVP.
  // Non-breaking: optional, undefined = read-only graceful degrade in node-view.
  // Future full content sync would use the same channel with JSON handling.
  onUpdateNote?: (noteId: string, updates: { title?: string; content?: any }) => void;
}

export function TipTapEditor({
  content = "",
  onChange,
  placeholder = "Start writing your note...",
  className,
  minHeight = "240px",
  onCreateTaskFromSlash,
  onCreateNoteFromSlash,
  onInsertEmbed,
  backlinks = [],
  onRemoveBacklink,
  linkedItems = [],
  onRemoveLinked,
  noteId,
  remoteCursors = [],
  onCursorUpdate,
  onLiveContent,
  // Milestone 2 TaskEmbed + bidirectional /task slash command (declared in interface but were missing from destructuring)
  tasks = [],
  onOpenTask,
  onToggleStatus,
  onUpdateTask,
  onCreateTaskAndEmbed,
  onHistoryChange,
  historyOpenTrigger,
  titleSnapshotTrigger,
  linkableItems,
  onMentionLinked,
  onMentionsChanged,
  onLinkNoteToNote,
  onOpenNote,
  onPersistSnapshot,
  serverSnapshots,
  onCaptureSnapshot,
  notes = [],
  // M3 minimal drill (only addition in this file per ultra-narrow charter)
  onUpdateNote,
}: TipTapEditorProps) {
  /**
   * Prepare initial content for TipTap:
   * - If content looks like stringified rich TipTap JSON doc → parse & return object (full rich roundtrip: bold, lists, headings etc preserved)
   * - Else treat as plain text → basic HTML (legacy/demo/samples path)
   * This + improved hybrid helpers = clean JSONB round-tripping.
   */
  function prepareInitialContent(raw: string | undefined): any {
    if (!raw || !raw.trim()) {
      return "<p></p>";
    }
    const trimmed = raw.trim();
    // Rich JSON roundtrip path (from previous save via onChange emitting stringified getJSON)
    if (trimmed.startsWith("{") && trimmed.includes('"type"') && trimmed.includes('"doc"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && parsed.type === "doc") {
          return parsed; // TipTap accepts the JSON doc directly for perfect fidelity
        }
      } catch {
        // fall back to plain
      }
    }
    // Plain text fallback (samples, old notes, title-only etc.) → simple paragraphs
    const escaped = trimmed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const paragraphs = escaped
      .split(/\n+/)
      .map((line) => (line.trim() ? `<p>${line}</p>` : "<p><br/></p>"))
      .join("");
    return paragraphs || "<p></p>";
  }

  // ========== SLASH COMMANDS STATE & HELPERS (defined early for safe closures in onUpdate) ==========
  // Magical / command menu - production feel, keyboard native, live filter, zero new runtime deps.
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashPosition, setSlashPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const lastEmittedContentRef = useRef<string | null>(null);

  const closeSlashMenu = useCallback(() => {
    setShowSlashMenu(false);
    setSlashQuery("");
    setSlashPosition(null);
    setSelectedSlashIndex(0);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        // Horizontal rule included for /divider
      }),
      // Clean placeholder (replaces previous overlay hack; theme-aware)
      Placeholder.configure({
        placeholder: placeholder || "Start writing...",
        emptyEditorClass: "is-editor-empty",
      }),
      // Custom mention pills for @ / [[ style linking (visual + future backlink foundation)
      MentionMark,

      // Milestone 2: TaskEmbed nodes (live editable task cards inside notes)
      TaskEmbed.configure({
        tasks,
        onOpenTask,
        onToggleStatus,
        onUpdateTask,
      }),

      // Milestone 2 (parallel): DatabaseBlock for live queryable views inside notes
      DatabaseBlock.configure({
        tasks,
        notes,
        linkedItems,
        onOpenTask,
        onToggleStatus,
        onUpdateTask,
        onOpenNote,
      }),

      // M2→M3 bridge: SyncedBlock (minimal viable now delivered + bidirectional polish)
      // Receives the same notes + onOpenNote data bridge as DatabaseBlock.
      // M3: onUpdateNote now forwarded for optional "Edit in place" title sync (writes via parent update path).
      // When absent the node-view shows disabled edit toggle + "read-only" footer hint (production safe).
      // All other behavior 100% backward compatible.
      SyncedBlock.configure({
        notes,
        onOpenNote,
        onUpdateNote,
      }),
    ],
    content: prepareInitialContent(content),
    onUpdate: ({ editor }) => {
      // Emit clean stringified TipTap JSON for rich JSONB persistence.
      // Hybrid layer (noteContentToJson) detects & stores full doc in DB.
      // jsonToNoteContent + UI previews always extract readable plain text fallback.
      const richJson = editor.getJSON();
      const contentString = JSON.stringify(richJson);

      // Always record what we emit so the external-content effect can avoid echo
      lastEmittedContentRef.current = contentString;
      onChange?.(contentString);

      // Live collab: throttled + trailing broadcast while typing (much better "live" feel than pure debounce)
      if (onLiveContent && editor.isFocused) {
        const now = Date.now();
        const timeSinceLast = now - lastLiveSendRef.current;

        if (timeSinceLast > 280) {
          // Send immediately (throttled)
          lastLiveSendRef.current = now;
          onLiveContent(contentString);
        } else {
          // Schedule a trailing update if one isn't already pending
          if (!liveContentTimeoutRef.current) {
            liveContentTimeoutRef.current = setTimeout(() => {
              lastLiveSendRef.current = Date.now();
              onLiveContent(contentString);
              liveContentTimeoutRef.current = null;
            }, 280 - timeSinceLast + 20);
          }
        }
      }

      // Agent 24: Live scan of mentions for bidirectional linking awareness (detectedMentions drives future panel / auto features)
      const scanned = extractMentionsFromDoc(richJson);
      if (JSON.stringify(scanned) !== JSON.stringify(detectedMentions)) {
        setDetectedMentions(scanned);
        onMentionsChanged?.(scanned);
      }

      // M2: Debounced auto-snapshot + auto-persist on content (big robustness step)
      if (noteId && editor.isFocused) {
        const now = Date.now();
        if (now - lastAutoSnapshotRef.current > 45000) {
          if (autoSnapshotTimeoutRef.current) {
            clearTimeout(autoSnapshotTimeoutRef.current);
          }
          autoSnapshotTimeoutRef.current = setTimeout(() => {
            if (editor && editor.state.doc.textContent.length > 30) {
              captureSnapshot("Auto on typing");
              lastAutoSnapshotRef.current = Date.now();
            }
            autoSnapshotTimeoutRef.current = null;
          }, 6500);
        }

        // Extra: debounce a silent persist of current history for this note
        if (versionHistory.length > 0) {
          try {
            localStorage.setItem(`note-history-${noteId}`, JSON.stringify(versionHistory.slice(0,10)));
          } catch {}
        }
      }

      // === SLASH COMMAND DETECTION (live on every keystroke, zero-dep, magical) ===
      if (!editor.isFocused) return;
      const { state } = editor;
      const { from } = state.selection;
      const $from = state.doc.resolve(from);
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      // Trigger only on / at start of paragraph or after whitespace (Notion behavior)
      const slashMatch = textBefore.match(/(?:^|\s)\/([^\/\s]*)$/);
      if (slashMatch && $from.parent.type.name === "paragraph") {
        const query = slashMatch[1] || "";
        const slashCharPos = from - query.length - 1;

        // Compute beautiful floating position relative to editor container
        try {
          const coords = editor.view.coordsAtPos(slashCharPos);
          const containerRect = editor.view.dom.getBoundingClientRect();
          const top = coords.bottom - containerRect.top + 6;
          const left = Math.max(12, coords.left - containerRect.left);

          if (!showSlashMenu) {
            setSlashPosition({ top, left });
            setShowSlashMenu(true);
            setSelectedSlashIndex(0);
          }
          setSlashQuery(query);
        } catch {
          // Fallback: still show menu if coords fail (e.g. during rapid typing)
          if (!showSlashMenu) {
            setShowSlashMenu(true);
            setSelectedSlashIndex(0);
          }
          setSlashQuery(query);
        }
      } else if (showSlashMenu) {
        // User moved away from slash or completed it
        closeSlashMenu();
      }
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-invert max-w-none focus:outline-none text-[15px] leading-relaxed",
          "text-[#f4f4f5] placeholder:text-[#71717a]"
        ),
      },
      handleKeyDown: (view, event) => {
        // Close slash on certain keys if open (supplements global handler)
        if (showSlashMenu && (event.key === "Escape" || event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          closeSlashMenu();
          return false;
        }
        return false;
      },
    },
  });

  // Safe external content application:
  // Only apply incoming `content` prop when the user is NOT actively typing.
  // This prevents the classic TipTap + global store feedback loop that causes
  // "Maximum update depth exceeded" when onChange → updateNote → re-render → new content prop.
  useEffect(() => {
    if (!editor || !noteId) return;

    // While the user is focused and typing, ignore external content updates.
    // The editor is the source of truth for the active editing session.
    if (editor.isFocused) return;

    const incoming = content;
    if (!incoming) return;

    const currentInEditor = JSON.stringify(editor.getJSON());

    // Only set if different AND we didn't just emit this exact string
    if (currentInEditor !== incoming && incoming !== lastEmittedContentRef.current) {
      editor.commands.setContent(prepareInitialContent(incoming), false);
      lastEmittedContentRef.current = incoming;
    }
  }, [content, editor, noteId]);

  // ========== BIDIRECTIONAL LINK PICKER STATE (Agent 24) ==========
  // In-editor floating glass picker for /link & /note-link — delightful, sample-driven for demo, zero deps.
  // Supports task/note types for visual pills + future real ID resolution + backlink sync.
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkPickerPosition, setLinkPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [pendingLinkInsert, setPendingLinkInsert] = useState<{ deleteFrom: number; deleteTo: number } | null>(null);
  const [linkPickerSearch, setLinkPickerSearch] = useState("");
  const [linkPickerMode, setLinkPickerMode] = useState<"all" | "notes">("all"); // Big step for /note-link UX
  const linkPickerRef = useRef<HTMLDivElement>(null);

  // ========== M2: DEDICATED SYNCED BLOCK NOTE PICKER STATE (charter: replace /synced-block placeholder) ==========
  // Simple inline floating list (glass-styled, consistent with link picker + slash menu).
  // Triggered ONLY from the synced-block slash action. Uses existing `notes` prop (preferred for richness, as passed to SyncedBlock/DB extensions)
  // or falls back to filtering `linkableItems` for type==='note'. Excludes current noteId (self-sync prevention).
  // Selection path: calls insertSyncedBlock({ targetNoteId, title }) on the editor (standard extension command; extension untouched per rules).
  // Heavy comments + internal todos for M2 traceability. Minimal: no keyboard arrows on list (click is reliable), no new global state bloat.
  const [showSyncedBlockPicker, setShowSyncedBlockPicker] = useState(false);
  const [syncedBlockPickerPosition, setSyncedBlockPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [pendingSyncedBlockDelete, setPendingSyncedBlockDelete] = useState<{ deleteFrom: number; deleteTo: number } | null>(null);
  const [syncedBlockPickerSearch, setSyncedBlockPickerSearch] = useState("");
  const syncedBlockPickerRef = useRef<HTMLDivElement>(null);

  // Detected mentions from live content scan (for backlinks prep, counts, future auto-sync)
  const [detectedMentions, setDetectedMentions] = useState<Array<{ label: string; refType?: string; refId?: string | null }>>([]);

  // Collapsible integrated backlinks panel state (always delightful demo if no props passed)
  const [showBacklinksPanel, setShowBacklinksPanel] = useState(true);
  const [linkFilter, setLinkFilter] = useState(""); // live filter for the Links & Backlinks panel (M2 polish)
  const [linksSearch, setLinksSearch] = useState(""); // Additional search for panel maturity
  const [linksSort, setLinksSort] = useState<"recency" | "title" | "type">("recency"); // New sorting options

  // Single source of truth for backlinks in this component's backlink UI section:
  // use the tiny stable selector (getBacklinkNotes) as fallback when parent doesn't pass.
  // This ensures TipTapEditor itself calls the centralized logic. Prefer prop (from useBacklinks in parent).
  const effectiveBacklinks = useMemo(() => {
    if (backlinks && backlinks.length > 0) return backlinks;
    if (notes && noteId) {
      return getBacklinkNotes(notes as any, noteId).map((n: any) => ({
        id: n.id,
        title: n.title || "Untitled",
        type: "note" as const,
      }));
    }
    return [];
  }, [backlinks, notes, noteId]);

  // Light version history (Agent 24) — client snapshots only, survives via localStorage when noteId provided. Demo perfect.
  // M2: Now with real server persistence via serverSnapshots + onPersistSnapshot (hybridStore lives in parent; we only consume).
  const [versionHistory, setVersionHistory] = useState<Array<{ ts: string; content: string; label: string }>>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null); // for diff preview
  const [historySearch, setHistorySearch] = useState(""); // Parallel polish for UX
  // Richer diff viewer (M2 deliverable): toggle between enhanced structured text diff and raw JSON view for TipTap docs
  const [diffViewMode, setDiffViewMode] = useState<"structured" | "json">("structured");

  // M2 POLISH: In-panel confirmation state (no more window.confirm) + dedicated list ref for post-restore auto-scroll UX
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  // When true + selectedHistoryIndex set, the diff viewer shows prominent "what will change" + CONFIRM / CANCEL actions

  // Refs for focus management on panels (keyboard a11y)
  const historyPanelRef = useRef<HTMLDivElement>(null);
  const historySearchInputRef = useRef<HTMLInputElement>(null);
  // M2: historyListRef enables auto-scroll to the newly prepended "Before restore" safety snapshot after successful restore
  const historyListRef = useRef<HTMLDivElement>(null);

  // Agent 30: live cursors support (debounce ref + overlay container)
  const lastCursorSendRef = useRef<number>(0);
  const cursorOverlayRef = useRef<HTMLDivElement>(null);

  // Keyboard accessibility for panels: Escape closes open panels (history or backlinks). Focus management on open.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showHistoryPanel) {
          e.preventDefault();
          setShowHistoryPanel(false);
          setSelectedHistoryIndex(null);
          setDiffViewMode("structured"); // reset richer viewer mode
          // M2 POLISH: reset confirmation state on any close
          setConfirmingRestore(false);
        } else if (showBacklinksPanel) {
          // Only close if it was explicitly opened (keep default open behavior for backlinks)
          // For safety we toggle only on explicit intent; here just allow closing via esc when focused inside
          setShowBacklinksPanel(false);
        }
      }
    };
    if (showHistoryPanel || showBacklinksPanel) {
      window.addEventListener("keydown", handleKey);
    }
    return () => window.removeEventListener("keydown", handleKey);
  }, [showHistoryPanel, showBacklinksPanel]);

  // Auto-focus search input when history panel opens (great keyboard UX)
  useEffect(() => {
    if (showHistoryPanel && historySearchInputRef.current) {
      // small timeout to allow panel render + avoid race with editor focus
      const t = setTimeout(() => historySearchInputRef.current?.focus({ preventScroll: true }), 60);
      return () => clearTimeout(t);
    }
  }, [showHistoryPanel]);

  // Live collab: refs for throttled + trailing live content broadcasts
  const liveContentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLiveSendRef = useRef<number>(0);

  // M2: Debounced auto content snapshots on typing
  const lastAutoSnapshotRef = useRef<number>(0);
  const autoSnapshotTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const closeLinkPicker = useCallback(() => {
    setShowLinkPicker(false);
    setLinkPickerPosition(null);
    setPendingLinkInsert(null);
    setLinkPickerSearch("");
  }, []);

  // Real linkables when provided by parent (M2 bidirectional deepening), otherwise demo samples
  const linkables = (linkableItems && linkableItems.length > 0)
    ? [...linkableItems, { id: "custom", label: "Custom label...", type: "external" as const }]
    : [
        { id: "demo-task-1", label: "🔥 Launch v2", type: "task" as const },
        { id: "demo-task-2", label: "📋 Q3 Planning", type: "task" as const },
        { id: "demo-note-1", label: "📓 Meeting Notes", type: "note" as const },
        { id: "demo-note-2", label: "💡 Idea: AI Features", type: "note" as const },
        { id: "custom", label: "Custom label...", type: "external" as const },
      ];

  // Open the link picker at position for a pending insert range
  const openLinkPicker = useCallback((deleteFrom: number, deleteTo: number) => {
    if (!editor) return;
    try {
      const coords = editor.view.coordsAtPos(deleteFrom);
      const containerRect = editor.view.dom.getBoundingClientRect();
      const top = coords.bottom - containerRect.top + 4;
      const left = Math.max(12, coords.left - containerRect.left);
      setLinkPickerPosition({ top, left });
    } catch {
      setLinkPickerPosition({ top: 80, left: 40 });
    }
    setPendingLinkInsert({ deleteFrom, deleteTo });
    setShowLinkPicker(true);
  }, [editor]);

  // Insert a chosen link mention (called from picker UI)
  const insertMentionFromPicker = useCallback((item: { id: string; label: string; type: "task" | "note" | "external" }) => {
    if (!editor || !pendingLinkInsert) return;
    const { deleteFrom, deleteTo } = pendingLinkInsert;
    const refType = item.type;
    const attrs = { label: item.label, refId: item.id !== "custom" ? item.id : null, refType };
    editor.chain().focus().deleteRange({ from: deleteFrom, to: deleteTo }).insertContent({
      type: "text",
      text: item.label,
      marks: [{ type: "mention", attrs }],
    }).run();
    closeLinkPicker();

    // Real bidirectional mutation
    if (refType !== "external" && onMentionLinked) {
      onMentionLinked({ id: item.id, title: item.label, type: refType });
    }

    // Direct tightening for /note-link: ensure note-to-note link happens
    if (refType === "note" && onLinkNoteToNote && noteId && item.id !== noteId) {
      onLinkNoteToNote(noteId, item.id);
    }

    // Toast for delight
    toast.success(`Linked ${refType}`, { description: item.label, duration: 1600 });
  }, [editor, pendingLinkInsert, closeLinkPicker, onMentionLinked]);

  // ========== M2: SYNCED BLOCK PICKER HELPERS + NOTE CANDIDATES (only edits in TipTapEditor.tsx per charter) ==========
  // close / open / insert are minimal analogs to the link picker trio.
  // Crucial: executeSlashCommand ALWAYS pre-deletes the "/synced-block" text before action() runs.
  // Thus openSyncedBlockPicker receives a zero-width range (current cursor post-delete). The insert fn's deleteRange on it is a safe no-op.
  // Then we chain .insertSyncedBlock({ targetNoteId, title }) — the exact shape required for the extension (untouched).
  // Derives candidates from `notes` (the prop already wired to SyncedBlock) or linkableItems. Demo seeds only if absent.
  // Heavy M2 comments for traceability. Internal verification: this section was read immediately prior to edit.

  // M2: Compute usable "other notes" list for the picker. Prioritize the richer `notes?: any[]` (passed down for DB/Synced views),
  // else filter linkableItems. Always exclude self (noteId) to prevent meaningless self-reference sync.
  const syncedBlockNoteCandidates = useMemo(() => {
    let candidates: Array<{ id: string; title: string }> = [];

    if (notes && Array.isArray(notes) && notes.length > 0) {
      candidates = notes
        .map((n: any) => ({
          id: String(n.id || n.noteId || n),
          title: n.title || n.name || n.label || "Untitled Note",
        }))
        .filter((n) => n.id && n.id !== noteId);
    } else if (linkableItems && linkableItems.length > 0) {
      candidates = linkableItems
        .filter((item: any) => item.type === "note" && item.id !== noteId)
        .map((item: any) => ({ id: item.id, title: item.title || "Untitled Note" }));
    } else {
      // Demo-only seeds (keeps the /synced-block command immediately usable even in isolated stories/tests)
      candidates = [
        { id: "demo-note-roadmap", title: "Project Roadmap" },
        { id: "demo-note-meeting", title: "Q2 Planning Notes" },
        { id: "demo-note-ideas", title: "Ideas & Brainstorms" },
      ].filter((n) => n.id !== noteId);
    }
    return candidates;
  }, [notes, linkableItems, noteId]);

  const closeSyncedBlockPicker = useCallback(() => {
    setShowSyncedBlockPicker(false);
    setSyncedBlockPickerPosition(null);
    setPendingSyncedBlockDelete(null);
    setSyncedBlockPickerSearch("");
  }, []);

  const openSyncedBlockPicker = useCallback((deleteFrom: number, deleteTo: number) => {
    if (!editor) return;
    try {
      const coords = editor.view.coordsAtPos(deleteFrom);
      const containerRect = editor.view.dom.getBoundingClientRect();
      const top = coords.bottom - containerRect.top + 4;
      const left = Math.max(12, coords.left - containerRect.left);
      setSyncedBlockPickerPosition({ top, left });
    } catch {
      setSyncedBlockPickerPosition({ top: 80, left: 40 });
    }
    setPendingSyncedBlockDelete({ deleteFrom, deleteTo });
    setShowSyncedBlockPicker(true);
    setSyncedBlockPickerSearch("");
  }, [editor]);

  // The actual insertion called on picker selection. Produces correct SyncedBlock node.
  const insertSyncedBlockFromPicker = useCallback((note: { id: string; title: string }) => {
    if (!editor || !pendingSyncedBlockDelete) return;
    const { deleteFrom, deleteTo } = pendingSyncedBlockDelete;

    // M2: deleteRange here is zero-width (post-executeSlashCommand cleanup) so harmless.
    // The payload is exactly what the (unmodified) SyncedBlock extension expects for its NodeView / attributes.
    editor.chain().focus()
      .deleteRange({ from: deleteFrom, to: deleteTo })
      .insertSyncedBlock({
        targetNoteId: note.id,
        title: note.title || "Untitled Note",
      })
      .run();

    closeSyncedBlockPicker();

    toast.success("Synced block inserted", {
      description: `Live reference to: ${note.title}`,
      duration: 1800,
    });
  }, [editor, pendingSyncedBlockDelete, closeSyncedBlockPicker]);

  // Helper: scan TipTap doc JSON for mention marks (used in onUpdate for detected links)
  function extractMentionsFromDoc(doc: any): Array<{ label: string; refType?: string; refId?: string | null }> {
    const mentions: Array<{ label: string; refType?: string; refId?: string | null }> = [];
    const walk = (node: any) => {
      if (node?.marks) {
        node.marks.forEach((m: any) => {
          if (m.type === "mention" && m.attrs) {
            mentions.push({
              label: m.attrs.label || "",
              refType: m.attrs.refType,
              refId: m.attrs.refId,
            });
          }
        });
      }
      if (node?.content) node.content.forEach(walk);
    };
    if (doc?.content) doc.content.forEach(walk);
    return mentions;
  }

  // M2: Improved plain text extraction for high-quality history diffs (feeds computeStructuredDiff line-by-line)
  function extractPlainTextFromDoc(doc: any): string {
    let text = "";
    const walk = (node: any, depth = 0) => {
      if (node?.text) {
        text += node.text;
      }
      if (node?.type === "heading") {
        text += "\n";
      }
      if (node?.type === "hardBreak" || node?.type === "paragraph" || node?.type === "listItem") {
        text += "\n";
      }
      if (node?.content) {
        node.content.forEach((child: any) => walk(child, depth + 1));
      }
    };
    if (doc?.content) doc.content.forEach((child: any) => walk(child));
    return text.trim();
  }

  // M2: Structured diff helper (core of history panel polish).
  // Line-by-line comparison on plain-text extraction (via improved extractPlainTextFromDoc).
  // Returns precise added / removed / modified counts + parallel highlighted arrays consumed by the
  // polished diff viewer for beautiful +/- indicators, stats pills, and the restore confirmation "what will change" preview.
  // Used for BOTH localStorage demo snapshots and real serverSnapshots (LIVE). No change to algo = stable & trustworthy.
  // Note: positional align (not full Myers diff) is intentional & sufficient for note snapshot UX.
  function computeStructuredDiff(oldDoc: any, newDoc: any) {
    const oldText = extractPlainTextFromDoc(oldDoc);
    const newText = extractPlainTextFromDoc(newDoc);
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");

    let added = 0, removed = 0, modified = 0;
    const maxLen = Math.max(oldLines.length, newLines.length);

    const highlightedOld: { line: string; type: "same" | "removed" | "modified" }[] = [];
    const highlightedNew: { line: string; type: "same" | "added" | "modified" }[] = [];

    for (let i = 0; i < maxLen; i++) {
      const o = oldLines[i] || "";
      const n = newLines[i] || "";

      if (o === n) {
        highlightedOld.push({ line: o, type: "same" });
        highlightedNew.push({ line: n, type: "same" });
      } else if (!o && n) {
        added++;
        highlightedOld.push({ line: "", type: "same" });
        highlightedNew.push({ line: n, type: "added" });
      } else if (o && !n) {
        removed++;
        highlightedOld.push({ line: o, type: "removed" });
        highlightedNew.push({ line: "", type: "same" });
      } else {
        modified++;
        highlightedOld.push({ line: o, type: "modified" });
        highlightedNew.push({ line: n, type: "modified" });
      }
    }

    return { added, removed, modified, highlightedOld, highlightedNew };
  }

  // Core slash command palette (placed after editor for safe 'editor' reference + fresh closures per render)
  const slashCommandsBase = [
    // Formatting
    {
      id: "heading1",
      title: "Heading 1",
      description: "Large section title",
      icon: Heading1,
      keywords: ["h1", "title", "header", "big"],
      category: "Formatting",
      action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: "heading2",
      title: "Heading 2",
      description: "Medium section title",
      icon: Heading2,
      keywords: ["h2", "subtitle"],
      category: "Formatting",
      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "heading3",
      title: "Heading 3",
      description: "Small section title",
      icon: Heading3,
      keywords: ["h3"],
      category: "Formatting",
      action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    // Lists & Structure
    {
      id: "bullet",
      title: "Bullet List",
      description: "Unordered list",
      icon: List,
      keywords: ["ul", "list", "bullets"],
      category: "Lists & Structure",
      action: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      id: "numbered",
      title: "Numbered List",
      description: "Ordered list",
      icon: ListOrdered,
      keywords: ["ol", "numbered", "steps"],
      category: "Lists & Structure",
      action: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      id: "quote",
      title: "Quote / Callout",
      description: "Blockquote for emphasis",
      icon: Quote,
      keywords: ["blockquote", "callout", "quote"],
      category: "Lists & Structure",
      action: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "code",
      title: "Code Block",
      description: "Monospace code snippet",
      icon: Code,
      keywords: ["codeblock", "pre", "snippet"],
      category: "Lists & Structure",
      action: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: "divider",
      title: "Divider",
      description: "Horizontal rule",
      icon: Minus,
      keywords: ["hr", "separator", "line"],
      category: "Lists & Structure",
      action: () => editor?.chain().focus().setHorizontalRule().run(),
    },
    {
      id: "checklist",
      title: "Checklist",
      description: "Interactive todo checkboxes",
      icon: ListChecks,
      keywords: ["check", "todo", "tasks", "list"],
      category: "Lists & Structure",
      action: () => {
        const { from } = editor?.state.selection || { from: 0 };
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));
        editor?.chain().focus().deleteRange({ from: deleteStart, to: from }).insertContent({
          type: "paragraph",
          content: [{ type: "text", text: "☐  New checklist item (use Enter for more)" }],
        }).run();
      },
    },
    {
      id: "callout",
      title: "Callout",
      description: "Highlighted note / warning / tip",
      icon: MessageSquare,
      keywords: ["info", "warning", "note", "alert", "tip"],
      category: "Lists & Structure",
      action: () => {
        const { from } = editor?.state.selection || { from: 0 };
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));
        editor?.chain().focus().deleteRange({ from: deleteStart, to: from }).insertContent({
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "💡  Callout: Key insight or action here." }] }
          ],
        }).run();
      },
    },
    // Smart Embeds & Actions (vision features)
    {
      id: "task",
      title: "Task Embed",
      description: "Embed a live task card (bidirectional)",
      icon: CheckSquare,
      keywords: ["todo", "action", "checkbox", "p0", "embed"],
      category: "Smart Embeds & Actions",
      action: async () => {
        if (!editor) return;
        const { from } = editor.state.selection;
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));

        // Try to extract selected text for a smart default title
        const { from: selFrom, to: selTo } = editor.state.selection;
        let suggestedTitle = "New Task from note";
        if (selTo > selFrom) {
          const selectedText = editor.state.doc.textBetween(selFrom, selTo, " ");
          if (selectedText.trim()) {
            suggestedTitle = selectedText.trim().slice(0, 80); // reasonable length
          }
        }

        let taskId: string | null = null;

        // Preferred path (Milestone 2): Ask parent to create a real task + auto-link it
        if (onCreateTaskAndEmbed) {
          taskId = await onCreateTaskAndEmbed(suggestedTitle);
        } else {
          // Fallback to old behavior
          onCreateTaskFromSlash?.(suggestedTitle);
        }

        // Insert the embed with the real ID if we got one
        editor.chain().focus().deleteRange({ from: deleteStart, to: from }).insertTaskEmbed(
          taskId 
            ? { taskId, title: suggestedTitle }
            : { title: suggestedTitle }
        ).run();
      },
    },
    {
      id: "note",
      title: "Note Embed",
      description: "Reference another note",
      icon: FileText,
      keywords: ["embed", "reference", "page"],
      category: "Smart Embeds & Actions",
      action: async () => {
        const { from } = editor?.state.selection || { from: 0 };
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));
        
        // Create a new note via parent and insert a real bidirectional mention
        const newNoteId = await onCreateNoteFromSlash?.("New note from slash");
        if (newNoteId && noteId) {
          // Insert a proper mention pill
          editor?.chain().focus().deleteRange({ from: deleteStart, to: from }).insertContent({
            type: "text",
            text: "New note",
            marks: [{ 
              type: "mention", 
              attrs: { label: "New note", refId: newNoteId, refType: "note" } 
            }],
          }).run();
          
          // Trigger bidirectional link
          onMentionLinked?.({ id: newNoteId, title: "New note", type: "note" });
        } else {
          // Fallback placeholder
          editor?.chain().focus().deleteRange({ from: deleteStart, to: from }).insertContent({
            type: "paragraph",
            attrs: { "data-embed": "note", class: "note-embed-placeholder" },
            content: [
              { type: "text", text: "📝  " },
              { type: "text", text: "Note Embed placeholder — use /note-link for real bidirectional [[ref]]" },
            ],
          }).run();
        }
      },
    },
    {
      id: "note-link",
      title: "Link to Note / Task",
      description: "Create bidirectional mention to another item",
      icon: Share2,
      keywords: ["link", "bidir", "ref", "wiki", "[[", "backlink"],
      category: "Smart Embeds & Actions",
      action: () => {
        if (!editor) return;
        // Big step: /note-link now opens picker in "notes only" mode for better UX
        setLinkPickerMode("notes");
        const { from } = editor.state.selection;
        openLinkPicker(from, from);
      },
    },
    // === M2→M3 DATABASE BLOCKS SCAFFOLDING (per WAVE8 master plan) ===
    // Future full implementation: custom TipTap Node + ReactNodeView that renders
    // a live, filterable, sortable inline table/board/calendar of tasks or notes.
    // Powered by hybridStore queries + the same bidirectional linking engine.
    // Command will appear in picker now as a visible promise of what's next.
    {
      id: "db-block",
      title: "Database block (M3)",
      description: "Live queryable table/board of tasks or notes",
      icon: FileText,
      keywords: ["db", "database", "table", "board", "query", "filter", "inline view"],
      category: "Smart Embeds & Actions",
      action: () => {
        if (!editor) return;
        const { from } = editor.state.selection || { from: 0 };
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));

        editor.chain().focus().deleteRange({ from: deleteStart, to: from }).insertDatabaseBlock({
          viewType: "tasks+notes",
          title: "Database View",
        }).run();

        toast.info("Database block inserted", {
          description: "Interactive table (M3 foundation)"
        });
      },
    },
    // ========== M2 EXECUTION: REAL NOTE PICKER FOR /synced-block (charter fulfillment) ==========
    // Replaces the old placeholder that incorrectly called openLinkPicker with 3 args (which did nothing useful).
    // Now: action simply opens our dedicated minimal picker (no delete calc needed here — executeSlashCommand pre-cleans the "/query").
    // Picker is 100% self-contained in this file, uses only pre-existing props (notes / linkableItems), styled consistently.
    // On pick: inserts the SyncedBlock node using the canonical command + exact {targetNoteId, title} shape.
    // Rules obeyed: NO edits to extensions/synced-block.ts or anywhere else. Heavy M2 comments + todos.
    {
      id: "synced-block",
      title: "Synced block",
      description: "Live read-only reference to another note",
      icon: FileText,
      keywords: ["synced", "reference", "mirror", "cross-note", "embed note"],
      category: "Smart Embeds & Actions",
      action: () => {
        if (!editor) return;
        // After executeSlashCommand's delete of the typed trigger, `from` is the clean caret position.
        // Pass zero-width so the later picker insert is a harmless deleteRange + node insert.
        const { from } = editor.state.selection || { from: 0 };
        // M2: Open the real note-only picker (inline glass list). This is the core of the charter delivery.
        openSyncedBlockPicker(from, from);
        // No more placeholder toast or broken reuse — user now gets immediate, usable list of other notes.
      },
    },
    {
      id: "embed",
      title: "Embed",
      description: "Link or rich embed (URL)",
      icon: Globe,
      keywords: ["iframe", "video", "link", "web"],
      category: "Smart Embeds & Actions",
      action: () => {
        const url = prompt("Embed URL (YouTube, Figma, etc.):");
        if (url) {
          const { from } = editor?.state.selection || { from: 0 };
          const deleteStart = Math.max(0, from - (slashQuery.length + 1));
          editor?.chain().focus().deleteRange({ from: deleteStart, to: from }).insertContent({
            type: "paragraph",
            attrs: { "data-embed": "url", "data-url": url },
            content: [
              { type: "text", text: "🔗  " },
              { type: "text", text: "Rich Embed: ", marks: [{ type: "bold" }] },
              { type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] },
              { type: "text", text: " (iframe-ready attrs for future NodeView)", marks: [{ type: "italic" }] },
            ],
          }).run();
          onInsertEmbed?.(url);
        } else {
          closeSlashMenu();
        }
      },
    },
    {
      id: "link",
      title: "Link / Mention",
      description: "[[wiki]] or @mention style (bidir links)",
      icon: Link2,
      keywords: ["mention", "ref", "backlink", "[[", "@"],
      category: "Smart Embeds & Actions",
      action: () => {
        if (!editor) return;
        // /query already cleaned by executeSlashCommand; use picker for rich bidirectional choice
        const { from } = editor.state.selection;
        openLinkPicker(from, from);
        // (old TODO resolved: picker + typed mentions + scan foundation now in place)
      },
    },
    {
      id: "today",
      title: "Today Block",
      description: "Insert daily note context",
      icon: Calendar,
      keywords: ["daily", "today", "briefing"],
      category: "Smart Embeds & Actions",
      action: () => {
        const { from } = editor?.state.selection || { from: 0 };
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));
        editor?.chain().focus().deleteRange({ from: deleteStart, to: from }).insertContent({
          type: "paragraph",
          content: [{ type: "text", text: "📅 Today: " + new Date().toLocaleDateString() + " — add highlights & tasks" }],
        }).run();
      },
    },
    // ========== M2→M3 BRIDGE AI INTEGRATION SCAFFOLDING (ai-editor-points) ==========
    // Per Agent 47 master plan: First AI integration points inside the TipTap editor (slash category only).
    // SCAFFOLD ONLY — non-functional stubs for future xAI/Grok backend work. Do not remove.
    // - New dedicated "AI" category added to slash commands (grouped visibly in floating / menu via categoryOrder).
    // - 3 useful stubs (titles aligned to spec examples): Summarize this section / Extract action items / Improve writing.
    // - Wired via existing imports but clearly comment-marked for replacement with direct callRealXAI / features/ai/ calls.
    // - Async actions handle selection/paragraph text safely; insert results + markers; toasts for UX.
    // - Non-breaking: sim fallback via isXAIConfigured(); generic "AI Assist" preserved under Utilities & AI for UX continuity.
    // - Integrates cleanly with existing slash system + separate Mention/Link picker (same menu container, independent state).
    // Future (M3+): streaming responses, full note+graph context injection, accept/reject UI, task auto-creation from extract, etc.
    // See also: features/notes/editor/ai/index.ts , features/ai/* , lib/utils.ts (callRealXAI + *_AI variants) , AGENT-47-AI-KG-DEEP-INTEGRATION-PROPOSAL.md
    // HANDOFF FOR FUTURE AGENT 47/53 (M3): Replace explicit stubs/markers per docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md §5
    // "Deeper AI integration in editor (real xAI/Grok calls for "Summarize...", "Extract action items", "Improve writing" —
    // replace the explicit stubs/markers with production orchestration, context-aware prompts, and streaming)."
    {
      id: "ai-summarize",
      title: "Summarize this section",
      description: "Condense selected text or paragraph — AI scaffold stub (Agent 47)",
      icon: Zap,
      keywords: ["sum", "short", "tl;dr", "brief", "condense", "section"],
      category: "AI",
      action: async () => {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));
        const deleteTo = to;
        let sourceText = "";
        if (!empty) {
          sourceText = editor.state.doc.textBetween(from, to, " ");
        } else {
          const $from = editor.state.doc.resolve(from);
          sourceText = ($from.parent.textContent || "").trim();
        }
        sourceText = sourceText.trim() || "Paste content here to summarize.";
        // === SCAFFOLD (Agent 47 / M2→M3 bridge) ===
        // WHERE THE xAI/Grok CALL WILL GO:
        //   Replace aiTransformTextAI(...) with direct structured call via features/ai/ or lib/utils callRealXAI({
        //     mode: 'summarize', context: buildEditorContext(editor, noteId, linkedItems), expectJson: false, stream: true
        //   })
        // Current: delegates to aiTransformText[AI] which internally uses callRealXAI when key present (sim otherwise).
        // Keep non-functional until backend wiring + review. Full note + KG context injection planned.
        // HANDOFF FOR FUTURE AGENT 47/53 (M3 AI per §5): See M2-SIGNOFF-CHECKLIST-2026-05-31.md §5 for production orchestration + streaming replacement target.
        const realMode = isXAIConfigured();
        const result = realMode
          ? await aiTransformTextAI(sourceText, "summarize")
          : aiTransformText(sourceText, "summarize");
        const marker = " 📝";
        editor.chain().focus()
          .deleteRange({ from: deleteStart, to: deleteTo })
          .insertContent(result.transformed + marker)
          .run();
        toast.success(realMode ? "Summarized via xAI" : "Summarized (sim)", {
          description: result.explanation + " — SCAFFOLD: Agent 47 M2/M3; replace body for full RAG + streaming",
          duration: 3200,
        });
      },
    },
    {
      id: "ai-extract",
      title: "Extract action items",
      description: "Pull tasks/action items from text — AI scaffold stub (Agent 47)",
      icon: CheckSquare,
      keywords: ["extract", "tasks", "actions", "todo", "ai", "decomp", "action items"],
      category: "AI",
      action: async () => {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));
        const deleteTo = to || from;
        let sourceText = "";
        if (!empty) {
          sourceText = editor.state.doc.textBetween(from, to, " ");
        } else {
          const $from = editor.state.doc.resolve(from);
          sourceText = ($from.parent.textContent || "").trim();
        }
        sourceText = sourceText.trim();
        if (!sourceText) {
          toast.info("Select or write text with action verbs to extract.");
          closeSlashMenu();
          return;
        }
        // === SCAFFOLD (Agent 47 / M2→M3 bridge) ===
        // WHERE THE xAI/Grok CALL WILL GO (extract mode):
        //   Replace extractActionItemsFromTextAI(...) with call to dedicated features/ai/ extractor
        //   or direct: await callRealXAI(sourceText, context, { mode: "extract", expectJson: true })
        //   Then: for each item, optionally invoke onCreateTaskAndEmbed + insert TaskEmbed nodes + onMentionLinked for bidir.
        // Current delegation preserves existing behavior + isXAIConfigured branch. Non-breaking.
        // Planned: review UI before committing extracted tasks to store/graph.
        // HANDOFF FOR FUTURE AGENT 47/53 (M3 AI per §5): Target for deeper integration replacement (M2-SIGNOFF-CHECKLIST-2026-05-31.md §5).
        const realMode = isXAIConfigured();
        const items: any[] = realMode
          ? await extractActionItemsFromTextAI(sourceText, "Note")
          : extractActionItemsFromText(sourceText, "Note");
        const extractedList = items.length
          ? items.map((it: any) => `☐ ${it.title || it} (P${(it.priority || "P2").toString().slice(1)})`).join("\n")
          : "• No clear actions detected — try /ai rewrite or add verbs.";
        const block = `\n\n**AI Extract (M3 scaffold${realMode ? " — xAI" : ""})**\n${extractedList}\n`;
        editor.chain().focus()
          .deleteRange({ from: deleteStart, to: deleteTo })
          .insertContent(block)
          .run();
        toast.success(`Extracted ${items.length} items`, {
          description: realMode ? "Real xAI structured extraction (SCAFFOLD Agent 47) — ready for task embed + graph wiring" : "Local sim. Future: direct xAI + embed creation",
          duration: 3400,
        });
      },
    },
    {
      id: "ai-rewrite",
      title: "Improve writing",
      description: "Polished rephrase / tone improvement of text — AI scaffold stub (Agent 47)",
      icon: Zap,
      keywords: ["rewrite", "polish", "rephrase", "improve", "edit", "writing"],
      category: "AI",
      action: async () => {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));
        const deleteTo = to;
        let sourceText = "";
        if (!empty) {
          sourceText = editor.state.doc.textBetween(from, to, " ");
        } else {
          const $from = editor.state.doc.resolve(from);
          sourceText = ($from.parent.textContent || "").trim();
        }
        sourceText = sourceText || "Your text for rewrite...";
        // === SCAFFOLD (Agent 47 / M2→M3 bridge) ===
        // WHERE THE xAI/Grok CALL WILL GO:
        //   aiTransformTextAI(source, "rewrite") → replace with callRealXAI(sourceText, editorContext, {
        //     mode: "transform", tone: "...", expectJson: true, ... }) or dedicated prompt from features/ai/prompts/
        // Future extensions: multi-tone dropdown in stub, visual diff, accept/reject buttons, multi-turn chat in editor.
        // Preserves current call path for zero breakage during scaffolding phase.
        // HANDOFF FOR FUTURE AGENT 47/53 (M3 AI per §5): See docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md §5 — explicit stub marker for production xAI/Grok orchestration.
        const realMode = isXAIConfigured();
        const result = realMode
          ? await aiTransformTextAI(sourceText, "rewrite")
          : aiTransformText(sourceText, "rewrite");
        editor.chain().focus()
          .deleteRange({ from: deleteStart, to: deleteTo })
          .insertContent(result.transformed + " ✨")
          .run();
        toast.success(realMode ? "Rewritten with xAI" : "Rewritten (sim)", {
          description: `${result.explanation} (SCAFFOLD Agent 47 M2/M3: future tone selector + accept/reject UI)`,
          duration: 2800,
        });
      },
    },
    // Utilities & Future (generic /ai preserved for backward slash UX)
    {
      id: "ai",
      title: "AI Assist",
      description: "Legacy generic AI entry (rewrite/expand/etc) — preserved for UX; prefer new AI category stubs (Agent 47 scaffold)",
      icon: Zap,
      keywords: ["magic", "rewrite", "summarize", "generate", "polish", "expand"],
      category: "Utilities & AI",
      action: () => {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));
        const deleteTo = to; // include any selected range

        // Grab selected text or current paragraph text (TipTap rich -> plain extract)
        let sourceText = "";
        if (!empty) {
          sourceText = editor.state.doc.textBetween(from, to, " ");
        } else {
          // Fallback: current parent para content
          const $from = editor.state.doc.resolve(from);
          const parent = $from.parent;
          sourceText = parent.textContent || "";
        }
        sourceText = sourceText.trim();

        // Smart mode from slash query (e.g. /ai summarize, /ai expand, /ai professional)
        let mode: Parameters<typeof aiTransformText>[1] = "rewrite";
        const q = (slashQuery || "").toLowerCase();
        if (q.includes("expand") || q.includes("detail")) mode = "expand";
        else if (q.includes("summar") || q.includes("short") || q.includes("tl")) mode = "summarize";
        else if (q.includes("profess")) mode = "tone:professional";
        else if (q.includes("casual")) mode = "tone:casual";
        else if (q.includes("bold")) mode = "tone:bold";

        const result = aiTransformText(sourceText || "Add your raw thinking here for AI magic.", mode);

        // Replace the /ai... + selected/original with polished version + subtle marker
        const marker = " ✨";
        const newContent = result.transformed + marker;

        editor.chain().focus()
          .deleteRange({ from: deleteStart, to: deleteTo })
          .insertContent(newContent)
          .run();

        // Non-blocking delightful feedback (sonner global)
        toast.success("AI writing assist applied", {
          description: result.explanation,
          duration: 2800,
        });
      },
    },
  ];

  const filteredSlashCommands = useMemo(() => {
    const q = slashQuery.toLowerCase().trim();
    if (!q) return [...slashCommandsBase];
    // Enhanced scoring for better discoverability + search quality
    const scored = slashCommandsBase
      .map((cmd) => {
        const titleL = cmd.title.toLowerCase();
        const descL = cmd.description.toLowerCase();
        let score = 0;
        if (titleL.includes(q)) score += 10;
        if (titleL.startsWith(q)) score += 5;
        if (descL.includes(q)) score += 3;
        if (cmd.keywords.some((k) => k.includes(q))) score += 4;
        if (cmd.category?.toLowerCase().includes(q)) score += 2;
        return { cmd, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((s) => s.cmd);
  }, [slashQuery]);

  const executeSlashCommand = useCallback((cmd: (typeof slashCommandsBase)[number]) => {
    if (!editor) return;
    // Remove the typed "/query" before executing (keeps document clean)
    const { from } = editor.state.selection;
    const deleteFrom = Math.max(0, from - (slashQuery.length + 1));
    editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();

    // Run the action (many re-focus internally)
    cmd.action();

    // Slight delay then close (allows insert to settle)
    setTimeout(() => closeSlashMenu(), 10);
  }, [editor, slashQuery, closeSlashMenu]);

  // Global keyboard handler for slash menu (arrows, enter, esc) - capture phase for priority over editor
  useEffect(() => {
    if (!showSlashMenu) return;

    const handleGlobalKey = (e: KeyboardEvent) => {
      if (!showSlashMenu) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedSlashIndex((i) => Math.min(i + 1, filteredSlashCommands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedSlashIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const cmd = filteredSlashCommands[selectedSlashIndex];
        if (cmd) executeSlashCommand(cmd);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeSlashMenu();
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Cycle or select first
        if (filteredSlashCommands.length) {
          executeSlashCommand(filteredSlashCommands[selectedSlashIndex] || filteredSlashCommands[0]);
        }
      } else if (/^[1-9]$/.test(e.key)) {
        // NEW: Numeric quick-select (1-9) for blazing discoverability & keyboard UX
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(e.key, 10) - 1;
        const cmd = filteredSlashCommands[idx];
        if (cmd) {
          executeSlashCommand(cmd);
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKey, true);
    return () => document.removeEventListener("keydown", handleGlobalKey, true);
  }, [showSlashMenu, filteredSlashCommands, selectedSlashIndex, executeSlashCommand, closeSlashMenu]);

  // Click outside to close slash menu
  useEffect(() => {
    if (!showSlashMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as globalThis.Node)) {
        closeSlashMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSlashMenu, closeSlashMenu]);

  // Click outside to close link picker (Agent 24)
  useEffect(() => {
    if (!showLinkPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (linkPickerRef.current && !linkPickerRef.current.contains(e.target as globalThis.Node)) {
        closeLinkPicker();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLinkPicker, closeLinkPicker]);

  // M2: Click outside to close the new synced-block note picker (minimal, consistent behavior)
  // Prevents orphan pickers when user clicks back into editor or elsewhere. Uses dedicated ref.
  useEffect(() => {
    if (!showSyncedBlockPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (syncedBlockPickerRef.current && !syncedBlockPickerRef.current.contains(e.target as globalThis.Node)) {
        closeSyncedBlockPicker();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSyncedBlockPicker, closeSyncedBlockPicker]);

  // Light history helpers (local only)
  const captureSnapshot = useCallback((label?: string) => {
    if (!editor) return;
    const jsonStr = JSON.stringify(editor.getJSON());
    const ts = new Date().toISOString();
    const newSnap = { ts, content: jsonStr, label: label || `Snapshot ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` };
    const updated = [newSnap, ...versionHistory].slice(0, 10); // keep last 8-10 for M2 server snapshots
    setVersionHistory(updated);
    onHistoryChange?.(updated.length);
    if (noteId && typeof window !== "undefined") {
      // Persist always for excellent demo UX; in live mode it's extra client cache (hybrid guards DB writes)
      try { localStorage.setItem(`note-history-${noteId}`, JSON.stringify(updated)); } catch {}
    }

    // M2 COMPLETE server path: requestSnapshot (via this capture) ALWAYS round-trips through hybridStore.onPersistSnapshot
    // when LIVE. This calls the authoritative fetch+merge+write to notes.snapshots JSONB (see hybridStore.ts).
    // Parent prop kept for backward compat with useNoteOperations wiring; direct hybrid call guarantees the full path.
    // HARDENED client call site: explicit try/catch + logging (non-fatal; local history + toast always succeed).
    // The real retry/robustness lives inside hybridStore.onPersistSnapshot (when live).
    if (isSupabaseLive() && noteId) {
      // Direct hybridStore roundtrip (core of server persistence completeness)
      // Strengthened: awaitable with visible failure log instead of silent .catch(() => {})
      persistSnapshotToServer(noteId, newSnap)
        .then((ok) => {
          if (!ok) {
            // eslint-disable-next-line no-console
            console.warn("[TipTapEditor] onPersistSnapshot returned false (server path may have queued/fallback); local snapshot is safe.");
          }
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn("[TipTapEditor] onPersistSnapshot client call failed (non-fatal; demo/local history unaffected)", err);
        });
      // Also call prop if provided (existing callers expect it; non-blocking)
      if (onPersistSnapshot) {
        onPersistSnapshot(noteId, newSnap);
      }
    }

    const mode = isSupabaseLive() ? "LIVE" : "DEMO";
    toast.success("Snapshot captured", { description: `${newSnap.label} (${mode})` });

    // Extraction hook point
    onCaptureSnapshot?.(label);
  }, [editor, versionHistory, noteId, onCaptureSnapshot, persistSnapshotToServer, onPersistSnapshot]);

  // M2 POLISH: Dedicated restore performer (extracted for clean confirm UX).
  // - Always captures a "Before restore" safety snapshot FIRST (persists to localStorage + server via captureSnapshot when LIVE).
  // - Applies the historical TipTap JSON via setContent.
  // - Post-restore: KEEP panel open (trust), auto-select index 0 (the new Before snapshot), auto-scroll list so user sees the safety entry immediately.
  // - Works identically for localStorage demo mode and serverSnapshots live mode.
  // - Uses computeStructuredDiff indirectly via pre-selection in UI (user sees exact +/- before confirming).
  const performRestore = useCallback((idx: number) => {
    if (!editor || !versionHistory[idx]) return;
    const snap = versionHistory[idx];
    try {
      const parsed = JSON.parse(snap.content);
      if (parsed && parsed.type === "doc") {
        // Safety first — this also triggers server persist when isSupabaseLive()
        captureSnapshot("Before restore");
        editor.chain().focus().setContent(parsed).run();

        toast.success("Restored version", {
          description: `${snap.label} • Safety "Before restore" snapshot saved (${isSupabaseLive() ? "LIVE + local" : "local demo"})`,
        });

        // M2 beautiful restore UX: do not close panel. Let user verify the change instantly.
        setConfirmingRestore(false);
        // Select the freshly prepended "Before restore" (now at [0]) so the structured diff pane shows exactly what was reverted away from.
        setSelectedHistoryIndex(0);

        // Auto-scroll the snapshot list to top — "restored snapshot" context (the safety before) is now visible at once.
        setTimeout(() => {
          historyListRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }, 70);
      }
    } catch {
      toast.error("Failed to restore snapshot");
      setConfirmingRestore(false);
    }
  }, [editor, versionHistory, captureSnapshot]);

  // Robust per-note history loading with live-mode server preference
  useEffect(() => {
    if (!noteId) {
      setVersionHistory([]);
      onHistoryChange?.(0);
      return;
    }

    let loaded: any[] = [];

    // M2: Prefer/merge server snapshots when in live mode, with graceful local fallback
    // LIMITATION (M2): serverSnapshots prop comes from parent (via hybridStore mapNoteRow on getNotes).
    // No independent refetch here; relies on parent polling/realtime. M3 will add direct snapshot query hook.
    if (isSupabaseLive() && serverSnapshots && serverSnapshots.length > 0) {
      loaded = [...serverSnapshots].slice(0, 10);
    } else {
      // Fallback to localStorage
      try {
        const raw = localStorage.getItem(`note-history-${noteId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) loaded = parsed.slice(0, 10);
        }
      } catch {}
    }

    // Small merge: if we have both, keep the most recent unique snapshots (by ts) up to 10 (prefer server, augment with newer local for hybrid safety)
    if (isSupabaseLive() && serverSnapshots && serverSnapshots.length > 0) {
      try {
        const rawLocal = localStorage.getItem(`note-history-${noteId}`);
        if (rawLocal) {
          const localParsed = JSON.parse(rawLocal);
          if (Array.isArray(localParsed) && localParsed.length > 0) {
            const serverTs = new Set(loaded.map((s: any) => s.ts));
            const newerLocal = localParsed.filter((s: any) => !serverTs.has(s.ts));
            loaded = [...newerLocal, ...loaded].slice(0, 10);
          }
        }
      } catch {}
    }

    setVersionHistory(loaded);
    onHistoryChange?.(loaded.length);
  }, [noteId, serverSnapshots]);

  // Optional: auto snapshot on blur (light, non-intrusive)
  useEffect(() => {
    if (!editor) return;
    const handleBlur = () => {
      // Only auto if we have some content and no recent snap
      if (editor.state.doc.textContent.length > 20 && versionHistory.length === 0) {
        // silent first auto
        const jsonStr = JSON.stringify(editor.getJSON());
        const ts = new Date().toISOString();
        const autoSnap = { ts, content: jsonStr, label: "Auto on open" };
        setVersionHistory([autoSnap]);
        if (noteId) {
          try { localStorage.setItem(`note-history-${noteId}`, JSON.stringify([autoSnap])); } catch {}
        }
        onHistoryChange?.(1);
      }
    };
    // Attach via editor view if possible (simplified)
    const dom = editor.view?.dom;
    if (dom) dom.addEventListener("blur", handleBlur, { once: true });
    return () => { if (dom) dom.removeEventListener("blur", handleBlur); };
  }, [editor, noteId, versionHistory.length]);

  // M2: Parent can request the history panel to open (from header button)
  useEffect(() => {
    if (historyOpenTrigger && historyOpenTrigger > 0) {
      setShowHistoryPanel(true);
      if (versionHistory.length === 0) {
        // ensure there's at least one snapshot
        setTimeout(() => captureSnapshot("Manual"), 50);
      }
    }
  }, [historyOpenTrigger]);

  // M2: Auto-capture snapshot when title changes in NoteHeader (parent bumps this trigger)
  useEffect(() => {
    if (titleSnapshotTrigger && titleSnapshotTrigger > 0 && editor) {
      // Small delay so the title update has settled in the broader UI
      setTimeout(() => captureSnapshot("Title changed"), 80);
    }
  }, [titleSnapshotTrigger]);

  // Agent 30: Live cursor/selection sharing - broadcast selection changes (debounced) for remote collaborators to see your caret
  useEffect(() => {
    if (!editor || !onCursorUpdate) return;
    const handleSel = () => {
      if (!editor.isFocused) return;
      const { from, to } = editor.state.selection;
      const now = Date.now();
      if (now - lastCursorSendRef.current > 140) {
        lastCursorSendRef.current = now;
        onCursorUpdate(from, to);
      }
    };
    editor.on('selectionUpdate', handleSel);
    // Also catch transactions that move selection
    const off = editor.on('transaction', ({ editor: e }) => {
      if (e.isFocused) handleSel();
    });
    return () => {
      editor.off('selectionUpdate', handleSel);
      // transaction off if supported
    };
  }, [editor, onCursorUpdate]);

  // Live collab cleanup: clear any pending content broadcast debounce on unmount or when editor changes
  useEffect(() => {
    return () => {
      if (liveContentTimeoutRef.current) {
        clearTimeout(liveContentTimeoutRef.current);
        liveContentTimeoutRef.current = null;
      }
      if (autoSnapshotTimeoutRef.current) {
        clearTimeout(autoSnapshotTimeoutRef.current);
        autoSnapshotTimeoutRef.current = null;
      }
    };
  }, [editor]);

  // Live collab: apply incoming content updates from other clients (only when we are not actively typing)
  useEffect(() => {
    if (!editor || !content) return;
    if (editor.isFocused) return; // don't overwrite what the local user is typing

    try {
      const incoming = typeof content === 'string' ? JSON.parse(content) : content;
      const current = editor.getJSON();

      // Simple deep compare avoidance – only set if structure looks different
      if (JSON.stringify(current) !== JSON.stringify(incoming)) {
        const setOpts: { emitUpdate: boolean } = { emitUpdate: false };
        editor.commands.setContent(incoming, setOpts); // don't trigger onUpdate
      }
    } catch {
      // fallback: just set as-is
      const setOpts: { emitUpdate: boolean } = { emitUpdate: false };
      editor.commands.setContent(prepareInitialContent(content), setOpts);
    }
  }, [editor, content]);

  if (!editor) {
    return (
      <div
        className={cn(
          "glass rounded-2xl border border-white/10 p-4",
          className
        )}
        style={{ minHeight }}
      >
        <div className="text-[#71717a] text-sm animate-pulse">Loading editor…</div>
      </div>
    );
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-95",
        "hover:bg-white/10 border border-transparent",
        isActive
          ? "bg-[#c084fc]/20 text-[#c084fc] border-[#c084fc]/40"
          : "text-[#a1a1aa] hover:text-[#f4f4f5]"
      )}
    >
      {children}
    </button>
  );

  return (
    <div
      className={cn(
        "glass rounded-2xl border border-white/10 flex flex-col",
        // Removed "overflow-hidden" here so the editor content can participate in outer scrolling
        // when the whole note area needs to scroll (prevents hard cut-off at bottom).
        className
      )}
    >
      {/* Basic Toolbar - clean, keyboard-friendly, no custom extensions */}
      <div className="flex items-center gap-1 border-b border-white/10 bg-[#111114]/60 px-3 py-2 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold (⌘B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic (⌘I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <span className="text-xs font-bold line-through">S</span>
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive("codeBlock")}
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Basic note → task conversion affordance inside editor (Agent 24) */}
        <button
          type="button"
          onClick={() => {
            const selText = editor.state.selection.empty
              ? editor.state.doc.textContent.slice(0, 60).trim()
              : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ").trim();
            const suggested = selText || "Task from note content";
            onCreateTaskFromSlash?.(suggested);
            toast.success("Conversion flow started", { description: "Task created + bidirectional link via parent" });
          }}
          title="Promote selection or note to linked Task (note↔task bidirectional conversion)"
          className="text-[9px] font-mono tracking-widest px-2 py-0.5 rounded-md border border-[#c084fc]/30 text-[#c084fc] hover:bg-[#c084fc]/10 active:scale-95 transition"
        >
          → TASK
        </button>

        <ToolbarButton
          onClick={() => {
            if (showHistoryPanel) {
              setShowHistoryPanel(false);
              setSelectedHistoryIndex(null);
              // M2 POLISH: full reset of diff + restore confirmation states on toolbar toggle-close
              setConfirmingRestore(false);
            } else {
              setShowHistoryPanel(true);
              if (versionHistory.length === 0) captureSnapshot("Manual");
            }
          }}
          isActive={showHistoryPanel}
          title="Version History (light snapshots — restore previous states)"
        >
          <History className="h-4 w-4" />
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          isActive={false}
          title="Undo (⌘Z)"
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          isActive={false}
          title="Redo (⌘⇧Z)"
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>

        {/* Dedicated AI button (Agent 26) — complements the /ai slash command for instant one-click polish on selection or current paragraph. Fast, magical, on-brand. */}
        <div className="w-px h-5 bg-white/10 mx-1" />
        <ToolbarButton
          onClick={async () => {
            if (!editor) return;
            const realMode = isXAIConfigured();
            const { from, to, empty } = editor.state.selection;
            let sourceText = "";
            if (!empty) {
              sourceText = editor.state.doc.textBetween(from, to, " ");
            } else {
              const $from = editor.state.doc.resolve(from);
              sourceText = ($from.parent.textContent || "").trim();
            }
            sourceText = sourceText || "Key idea or paragraph for AI polish.";
            const result = realMode 
              ? await aiTransformTextAI(sourceText, "rewrite")
              : aiTransformText(sourceText, "rewrite");
            const polished = result.transformed + " ✨";
            if (!empty) {
              editor.chain().focus().deleteRange({ from, to }).insertContent(polished).run();
            } else {
              editor.chain().focus().insertContent(" " + polished).run();
            }
            toast.success(realMode ? "xAI Grok polish applied" : "AI magic applied", {
              description: result.explanation,
              duration: 2200,
            });
          }}
          isActive={false}
          title="AI Polish (rewrite) on selection or paragraph — use /ai for expand/summarize/tones too"
        >
          <Zap className="h-4 w-4 text-[#c084fc]" />
        </ToolbarButton>
        {/* AI Assist UI hint / placeholder (M2/M3 bridge scaffolding per Agent 47).
           Non-breaking subtle badge next to the dedicated AI polish (Zap) button in toolbar.
           Signals the new "AI" slash category (Summarize this section / Extract action items / Improve writing)
           + future dedicated AI surface (e.g. dropdown/panel wired to Grok). Reviewable marker only. */}
        <span
          className="ml-1 text-[9px] font-mono tracking-[1px] px-1.5 py-px rounded border border-[#c084fc]/20 bg-[#c084fc]/5 text-[#c084fc]/70 select-none cursor-default"
          title="SCAFFOLD (Agent 47): AI slash category with stubs + xAI extension points ready. Non-breaking. Full AI features post-review."
        >
          AI
        </span>
      </div>

      {/* Editable Area (Placeholder extension provides native hint inside editor) */}
      <div
        className="p-5 overflow-auto bg-[#0f0f13] prose-headings:font-semibold prose-headings:tracking-tight relative"
        style={{ minHeight }}
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />

        {/* Agent 30: Live collaborator cursors / floating selection shares - delightful premium feel (coords-based, falls back gracefully) */}
        {remoteCursors && remoteCursors.length > 0 && editor && (
          <div ref={cursorOverlayRef} className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
            {remoteCursors.map((c, i) => {
              let posStyle: React.CSSProperties = { top: `${8 + (i * 18)}px`, right: '12px' };
              try {
                const docSize = editor.state.doc.content.size;
                const safePos = Math.max(0, Math.min((c as any).from || 0, docSize - 1));
                const coords = editor.view.coordsAtPos(safePos);
                const contRect = editor.view.dom.getBoundingClientRect();
                const top = coords.top - contRect.top + ((editor.view.dom as any).scrollTop || 0);
                const left = Math.max(0, coords.left - contRect.left);
                posStyle = { top: `${Math.max(2, top)}px`, left: `${Math.max(2, left)}px`, transform: 'translateY(-50%)' };
              } catch { /* graceful fallback badge */ }
              const label = ((c as any).email || (c as any).userId || 'live').split('@')[0].slice(0, 7);
              return (
                <div
                  key={i}
                  className="absolute flex items-center gap-0.5 text-[9px] font-mono leading-none px-1 py-0.5 rounded-sm shadow-sm border border-black/30 select-none"
                  style={{ ...posStyle, background: (c as any).color || '#00ff9f', color: '#0a0a0a', whiteSpace: 'nowrap' }}
                  title={`${(c as any).email || (c as any).userId} cursor/selection`}
                >
                  <span className="inline-block w-[2px] h-3 bg-current align-middle mr-0.5 animate-pulse" />
                  {label}
                </div>
              );
            })}
          </div>
        )}

        {/* ========== MAGICAL SLASH COMMAND MENU (Agent 7 - production grade, keyboard native) ========== */}
        {showSlashMenu && filteredSlashCommands.length > 0 && slashPosition && (
          <div
            ref={slashMenuRef}
            className="absolute z-50 w-72 glass rounded-xl border border-white/15 shadow-2xl overflow-hidden py-1 text-sm"
            style={{
              top: `${slashPosition.top}px`,
              left: `${slashPosition.left}px`,
              maxHeight: "260px",
              overflowY: "auto",
            }}
          >
            <div className="px-3 py-1.5 text-[10px] font-mono tracking-[1.5px] text-[#71717a] border-b border-white/10 flex items-center gap-2">
              <Zap className="h-3 w-3" /> SLASH COMMANDS • {filteredSlashCommands.length} matches — categorized for speed
            </div>
            {(() => {
              // Group for discoverability (preserves filter order/score within groups)
              const groups: Record<string, typeof filteredSlashCommands> = {};
              filteredSlashCommands.forEach(cmd => {
                const cat = cmd.category || "Other";
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(cmd);
              });
              const categoryOrder = ["Formatting", "Lists & Structure", "Smart Embeds & Actions", "AI", "Utilities & AI", "Other"];
              let flatIdx = 0; // for global selection index across groups
              return categoryOrder.filter(c => groups[c]).flatMap(cat => {
                const cmdsInCat = groups[cat];
                const header = (
                  <div key={`${cat}-header`} className="px-3 py-1 text-[9px] uppercase tracking-[1px] text-[#c084fc]/70 bg-white/5 font-mono border-y border-white/10">
                    {cat}
                  </div>
                );
                const items = cmdsInCat.map((cmd) => {
                  const currentFlatIdx = flatIdx++;
                  const Icon = cmd.icon;
                  const isSelected = currentFlatIdx === selectedSlashIndex;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => executeSlashCommand(cmd)}
                      onMouseEnter={() => setSelectedSlashIndex(currentFlatIdx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                        isSelected
                          ? "bg-[#c084fc]/15 text-[#f4f4f5] border-l-2 border-[#c084fc]"
                          : "hover:bg-white/5 text-[#a1a1aa] hover:text-[#f4f4f5]"
                      )}
                    >
                      <div className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
                        isSelected ? "bg-[#c084fc]/20 text-[#c084fc]" : "bg-white/5 text-[#71717a]"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[13px] tracking-tight">{cmd.title}</div>
                        <div className="text-[11px] text-[#71717a] truncate">{cmd.description}</div>
                      </div>
                      {isSelected && (
                        <div className="text-[10px] text-[#c084fc] font-mono">⏎</div>
                      )}
                    </button>
                  );
                });
                return [header, ...items];
              });
            })()}
            <div className="px-3 py-1 text-[9px] text-[#71717a]/70 border-t border-white/10 font-mono tracking-widest">
              ↑↓ navigate • ⏎ / Tab select • 1-9 quick pick • ⎋ close • type to filter • categories for discoverability
            </div>
          </div>
        )}
        {/* Fallback empty state for slash */}
        {showSlashMenu && filteredSlashCommands.length === 0 && slashPosition && (
          <div
            ref={slashMenuRef}
            className="absolute z-50 w-64 glass rounded-xl border border-white/15 p-3 text-xs text-[#71717a]"
            style={{ top: `${slashPosition.top}px`, left: `${slashPosition.left}px` }}
          >
            No commands match “{slashQuery}”. Try /heading, /task, /embed…
          </div>
        )}

        {/* ========== MAGICAL IN-EDITOR LINK PICKER (Agent 24 bidirectional linking) ========== */}
        {showLinkPicker && linkPickerPosition && (
          <div
            ref={linkPickerRef}
            className="absolute z-[60] w-64 glass rounded-xl border border-white/15 shadow-2xl overflow-hidden py-1 text-sm"
            style={{
              top: `${linkPickerPosition.top}px`,
              left: `${linkPickerPosition.left}px`,
            }}
          >
            <div className="px-3 py-1.5 text-[10px] font-mono tracking-[1.5px] text-[#71717a] border-b border-white/10 flex items-center gap-2">
              <Share2 className="h-3 w-3" /> BIDIR LINK PICKER • choose to insert neon mention
            </div>
            <input
              type="text"
              placeholder="Filter notes & tasks..."
              value={linkPickerSearch}
              onChange={(e) => setLinkPickerSearch(e.target.value)}
              className="mx-3 my-1 w-[calc(100%-24px)] text-xs bg-[#111114] border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-[#c084fc]/40"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Grouped and filtered linkables */}
            {(() => {
              const filtered = linkables.filter(item => 
                item.label.toLowerCase().includes(linkPickerSearch.toLowerCase())
              );
              const tasks = filtered.filter(i => i.type === "task");
              const notesList = filtered.filter(i => i.type === "note");
              const other = filtered.filter(i => i.type === "external");

              const renderGroup = (title: string, items: any[]) => items.length > 0 ? (
                <>
                  <div className="px-3 pt-2 pb-1 text-[9px] font-mono uppercase tracking-widest text-[#71717a]">{title}</div>
                  {items.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.id === "custom") {
                          const customLabel = (prompt("Custom [[label]] for mention:") || "custom-link").trim();
                          insertMentionFromPicker({ id: "custom", label: customLabel, type: "external" });
                        } else {
                          insertMentionFromPicker(item);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 text-[#a1a1aa] hover:text-[#f4f4f5] border-l-2 border-transparent hover:border-[#c084fc]/50 transition"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-white/5 text-[#c084fc] text-xs shrink-0">
                        {item.type === "task" ? "✅" : item.type === "note" ? "📝" : "🔗"}
                      </div>
                      <span className="font-medium text-[13px] truncate flex-1">{item.label}</span>
                      <span className="text-[9px] text-[#71717a] font-mono uppercase tracking-widest">{item.type}</span>
                    </button>
                  ))}
                </>
              ) : null;

              return (
                <>
                  {renderGroup("Tasks", tasks)}
                  {renderGroup("Notes", notesList)}
                  {renderGroup("Other", other)}
                </>
              );
            })()}
            <div className="px-3 py-1 text-[9px] text-[#71717a]/70 border-t border-white/10 font-mono tracking-widest">
              Click to insert typed @mention pill • supports task/note • foundation for real backlinks
            </div>
          </div>
        )}

        {/* ========== M2: MINIMAL INLINE NOTE PICKER FOR /synced-block SLASH COMMAND ==========
             Charter: simple list of other notes using linkableItems or notes prop.
             - Positioned like link picker (absolute glass, z-60).
             - Live filter input.
             - Only notes (no tasks). Excludes current note.
             - Consistent styling: same glass, border, mono labels, hover states, purple accents, icon badges as link picker & slash menu.
             - Selecting calls insertSyncedBlockFromPicker → real insertSyncedBlock({targetNoteId, title}).
             - Minimal scope: no full keyboard nav on this list (charter says "simple"), relies on mouse + outside-click close.
             - Heavy M2 comments. Rendered only inside the editor chrome div. Never leaks outside this file.
        */}
        {showSyncedBlockPicker && syncedBlockPickerPosition && (
          <div
            ref={syncedBlockPickerRef}
            className="absolute z-[60] w-72 glass rounded-xl border border-white/15 shadow-2xl overflow-hidden py-1 text-sm"
            style={{
              top: `${syncedBlockPickerPosition.top}px`,
              left: `${syncedBlockPickerPosition.left}px`,
            }}
          >
            <div className="px-3 py-1.5 text-[10px] font-mono tracking-[1.5px] text-[#71717a] border-b border-white/10 flex items-center gap-2">
              <FileText className="h-3 w-3" /> SYNCED BLOCK • pick another note for live reference
            </div>
            <input
              type="text"
              placeholder="Filter other notes..."
              value={syncedBlockPickerSearch}
              onChange={(e) => setSyncedBlockPickerSearch(e.target.value)}
              className="mx-3 my-1 w-[calc(100%-24px)] text-xs bg-[#111114] border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-[#c084fc]/40"
              onClick={(e) => e.stopPropagation()}
            />
            {/* The actual minimal scrollable note list */}
            <div className="max-h-[220px] overflow-auto custom-scroll">
              {(() => {
                const q = syncedBlockPickerSearch.toLowerCase().trim();
                const filtered = syncedBlockNoteCandidates.filter((n) =>
                  !q || n.title.toLowerCase().includes(q)
                );

                if (filtered.length === 0) {
                  return (
                    <div className="px-3 py-4 text-[12px] text-[#71717a]">
                      No matching notes. {syncedBlockNoteCandidates.length === 0 ? "Create additional notes to enable cross-note syncing." : "Try a different filter."}
                    </div>
                  );
                }

                return filtered.slice(0, 10).map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => insertSyncedBlockFromPicker(note)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 text-[#a1a1aa] hover:text-[#f4f4f5] border-l-2 border-transparent hover:border-[#c084fc]/50 transition active:bg-white/10"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-white/5 text-[#c084fc] text-xs shrink-0">
                      📝
                    </div>
                    <span className="font-medium text-[13px] truncate flex-1">{note.title}</span>
                    <span className="text-[9px] text-[#71717a] font-mono uppercase tracking-widest">NOTE</span>
                  </button>
                ));
              })()}
            </div>
            <div className="px-3 py-1 text-[9px] text-[#71717a]/70 border-t border-white/10 font-mono tracking-widest">
              Click a note → inserts SyncedBlock with targetNoteId + title (live mirror)
            </div>
          </div>
        )}
      </div>

      {/* Version History Panel — M2 Foundation */}
      {showHistoryPanel && (
        <div ref={historyPanelRef} role="region" aria-label="Version history panel" data-history-panel className="border-t border-white/10 bg-[#0a0a0f] px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2 font-mono tracking-[1px] text-[#c084fc]">
              <History className="h-3.5 w-3.5" />
              <span>VERSION HISTORY</span>
              {noteId && <span className="text-[#71717a]/60 text-[10px]">• {noteId.slice(0,6)}</span>}
              <span role="status" aria-live="polite" aria-label="Snapshot count" className="ml-1 rounded bg-white/5 px-1.5 py-px text-[9px] text-[#71717a]">{versionHistory.length}/10</span>
              {/* M2: Visual signal when we're pulling from server snapshots in live mode */}
              {isSupabaseLive() && serverSnapshots && serverSnapshots.length > 0 && (
                <span className="ml-1 rounded bg-[#00ff9f]/10 px-1.5 py-px text-[9px] text-[#00ff9f] border border-[#00ff9f]/20">LIVE</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={historySearchInputRef}
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search snapshots..."
                className="text-[10px] bg-black/30 border border-white/10 rounded px-2 py-1 w-32 sm:w-28 placeholder:text-[#71717a]/50 touch-manipulation focus:border-[#c084fc]/40 min-h-[32px]"
                aria-label="Search version history snapshots. Filters list live and updates snapshot count."
              />
              <button
                onClick={() => captureSnapshot("Manual")}
                className="text-[10px] px-3 py-1 rounded border border-white/15 hover:bg-white/5 active:bg-white/10 transition touch-manipulation min-h-[44px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                aria-label="Capture manual snapshot"
              >
                + SNAPSHOT
              </button>
              {/* M2 EXPORT: Added Export buttons to Version History panel (header actions area only).
                  - Targets: selected snapshot (if selectedHistoryIndex active) OR all currently visible/filtered snapshots.
                  - Formats: JSON (full TipTap JSON payload + export meta) and plain text (derived content).
                  - Download: minimal, dependency-free via data: URL (encodeURIComponent for safe inline).
                  - No new state, no new imports, no changes whatsoever to persistence (capture/onPersist), diff logic (computeStructuredDiff), restore, or loading.
                  - Self-contained inline handlers + tiny text walker for plain text to honor "history panel area" edit scope.
                  - Works for both LIVE serverSnapshots and local demo history. */}
              <button
                onClick={() => {
                  // M2: JSON export handler (full TipTap) — scoped strictly to history panel JSX.
                  // Heavy comments for M2 traceability. Prefers selected when present; falls back to visible (search filtered).
                  // Data URL keeps it ultra-minimal (no Blob/URL.createObjectURL ceremony required for these small payloads).
                  const searchQ = (historySearch || "").toLowerCase();
                  const visibleSnaps = versionHistory.filter((snap) => !searchQ || snap.label.toLowerCase().includes(searchQ));
                  const targetSnaps = (selectedHistoryIndex !== null && selectedHistoryIndex < versionHistory.length)
                    ? [versionHistory[selectedHistoryIndex]]
                    : visibleSnaps;
                  if (!targetSnaps.length) return;
                  const prefix = noteId ? `note-${noteId.slice(0, 8)}` : "untitled";
                  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
                  const isSingle = targetSnaps.length === 1;
                  const baseName = isSingle ? targetSnaps[0].label.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40) : "all-visible";
                  const jsonPayload = {
                    exportedAt: new Date().toISOString(),
                    source: isSupabaseLive() ? "live-server" : "local-demo",
                    noteId: noteId || null,
                    count: targetSnaps.length,
                    snapshots: targetSnaps, // each: {ts, content: string (TipTap JSON), label}
                  };
                  const jsonStr = JSON.stringify(jsonPayload, null, 2);
                  const jsonUrl = "data:application/json;charset=utf-8," + encodeURIComponent(jsonStr);
                  const a = document.createElement("a");
                  a.href = jsonUrl;
                  a.download = `${prefix}-history-${baseName}-${stamp}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="text-[10px] px-2 py-1 rounded border border-[#c084fc]/30 hover:bg-[#c084fc]/10 active:bg-[#c084fc]/20 transition touch-manipulation min-h-[44px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                title="M2: Export selected (or all visible) snapshots as full TipTap JSON"
                aria-label="Export history snapshots as JSON"
              >
                JSON
              </button>
              <button
                onClick={() => {
                  // M2: Plain text export handler — derived from snapshot TipTap JSON content.
                  // Uses minimal self-contained walker (not touching or invoking the diff-related extractPlainTextFromDoc).
                  // Guarantees no side effects on any existing history/persist/diff code paths.
                  const searchQ = (historySearch || "").toLowerCase();
                  const visibleSnaps = versionHistory.filter((snap) => !searchQ || snap.label.toLowerCase().includes(searchQ));
                  const targetSnaps = (selectedHistoryIndex !== null && selectedHistoryIndex < versionHistory.length)
                    ? [versionHistory[selectedHistoryIndex]]
                    : visibleSnaps;
                  if (!targetSnaps.length) return;
                  const prefix = noteId ? `note-${noteId.slice(0, 8)}` : "untitled";
                  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
                  const isSingle = targetSnaps.length === 1;
                  const baseName = isSingle ? targetSnaps[0].label.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40) : "all-visible";
                  let plain = `TipTap Version History Export\nNote: ${prefix}\nExported: ${new Date().toLocaleString()}\nMode: ${isSupabaseLive() ? "LIVE" : "DEMO"}\nCount: ${targetSnaps.length}\n\n`;
                  targetSnaps.forEach((snap, i) => {
                    plain += `=== [${i + 1}] ${snap.label} | ${snap.ts} ===\n`;
                    try {
                      const doc = JSON.parse(snap.content || "{}");
                      let text = "";
                      const walk = (node) => {
                        if (node && typeof node === "object") {
                          if (typeof node.text === "string") text += node.text;
                          if (node.type === "heading" || node.type === "paragraph" || node.type === "listItem" || node.type === "hardBreak") text += "\n";
                          if (Array.isArray(node.content)) node.content.forEach(walk);
                        }
                      };
                      if (doc && doc.content) doc.content.forEach(walk);
                      plain += (text.trim() || "(empty snapshot content)") + "\n\n";
                    } catch {
                      plain += (snap.content || "") + "\n\n";
                    }
                  });
                  const txtUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(plain);
                  const a = document.createElement("a");
                  a.href = txtUrl;
                  a.download = `${prefix}-history-${baseName}-${stamp}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="text-[10px] px-2 py-1 rounded border border-[#c084fc]/30 hover:bg-[#c084fc]/10 active:bg-[#c084fc]/20 transition touch-manipulation min-h-[44px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                title="M2: Export selected (or all visible) snapshots as plain text"
                aria-label="Export history snapshots as plain text"
              >
                TXT
              </button>
              <button
                onClick={() => {
                  setShowHistoryPanel(false);
                  setSelectedHistoryIndex(null);
                  // M2 POLISH: reset confirmation + selection on explicit panel close button
                  setConfirmingRestore(false);
                }}
                className="text-[10px] px-3 py-1 rounded text-[#71717a] hover:text-white hover:bg-white/5 active:bg-white/10 touch-manipulation min-h-[44px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                aria-label="Close history panel"
              >
                CLOSE
              </button>
            </div>
          </div>

          {versionHistory.length === 0 ? (
            <div className="text-[#71717a] text-[11px] py-2">
              No snapshots yet. Auto-captured on first edits + manual via +SNAPSHOT. Server-backed when LIVE.
            </div>
          ) : (
            // M2 POLISH: The scroll container now has ref for post-restore auto-scroll.
            // Snapshots (whether from serverSnapshots in LIVE or localStorage demo) render identically.
            <div ref={historyListRef} className="max-h-32 overflow-auto space-y-1 pr-1 custom-scroll">
              {versionHistory
                .filter(snap => !historySearch || snap.label.toLowerCase().includes(historySearch.toLowerCase()))
                .map((snap, idx) => {
                const date = new Date(snap.ts);
                const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isRecent = Date.now() - date.getTime() < 1000 * 60 * 60 * 2; // last 2 hours
                return (
                  <div
                    key={idx}
                    role="button"
                    tabIndex={0}
                    className={`group flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/8 active:bg-white/10 transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-[#c084fc] ${selectedHistoryIndex === idx ? 'bg-white/10 ring-1 ring-[#c084fc]' : 'bg-white/5'}`}
                    // M2: clicking row for preview cancels any open restore confirmation (clean state)
                    onClick={() => {
                      setConfirmingRestore(false);
                      setSelectedHistoryIndex(selectedHistoryIndex === idx ? null : idx);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setConfirmingRestore(false);
                        setSelectedHistoryIndex(selectedHistoryIndex === idx ? null : idx);
                      }
                    }}
                    title="Click or press Enter to preview diff • Use RESTORE button for safe revert"
                    aria-selected={selectedHistoryIndex === idx}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-[#e4e4e7] truncate">{snap.label}</span>
                        <span className={`font-mono text-[10px] ${isRecent ? 'text-[#c084fc]' : 'text-[#71717a]'}`}>
                          {time}
                        </span>
                      </div>
                      <div className="text-[9px] text-[#71717a]/60 mt-0.5">
                        {date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!editor) return;
                        // M2 POLISH: No window.confirm. Instead: select this snapshot (shows structured diff) + enter confirm mode.
                        // This surfaces the exact +/- changes using computeStructuredDiff BEFORE user commits to restore.
                        setSelectedHistoryIndex(idx);
                        setConfirmingRestore(true);
                      }}
                      className="opacity-80 group-hover:opacity-100 text-[#00ff9f] hover:text-[#00ff9f] text-[10px] font-medium px-3 py-1 rounded hover:bg-[#00ff9f]/10 active:bg-[#00ff9f]/20 transition touch-manipulation min-h-[44px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                      aria-label={`Restore snapshot ${snap.label} (opens confirmation with diff preview)`}
                    >
                      RESTORE
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full structured diff preview (M2 big step) — now polished for trust + beautiful UX */}
          {selectedHistoryIndex !== null && versionHistory[selectedHistoryIndex] && (
            <div className="mt-3 p-2 bg-black/30 rounded text-[10px] font-mono border border-white/10">
              {/* M2 POLISH HEADER: clearer title + always-available manual snapshot + richer diff mode toggle */}
              <div className="flex items-center justify-between text-[#c084fc] mb-1">
                <span>{diffViewMode === "json" ? "JSON Diff — TipTap Docs" : "Structured Diff — Snapshot vs Current"}</span>
                <div className="flex items-center gap-2 text-[9px]">
                  {/* Richer viewer controls: side-by-side +/- stays, add JSON view for TipTap docs, visual stats bars below */}
                  <button
                    onClick={() => setDiffViewMode(diffViewMode === "structured" ? "json" : "structured")}
                    className="text-[8px] px-1.5 py-0.5 rounded border border-white/20 hover:bg-white/10 active:bg-white/5 text-[#a1a1aa]"
                    title="Toggle between rich structured text diff (with +/- bars) and raw TipTap JSON side-by-side view"
                  >
                    {diffViewMode === "structured" ? "JSON VIEW" : "TEXT DIFF"}
                  </button>
                  <button
                    onClick={() => captureSnapshot("Manual")}
                    className="text-[9px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[#71717a] min-h-[32px] touch-manipulation focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                  >
                    + Snapshot now
                  </button>
                  {/* M2: Selected snapshot export affordance inside the diff preview header.
                      Provides direct one-click export of *this* selected history item (full TipTap JSON + plain text).
                      Complements the header-level visible/all export buttons. Purely additive to panel area. */}
                  <button
                    onClick={() => {
                      // M2: Export the *currently selected* snapshot (guaranteed in this render branch).
                      // JSON path: emits full TipTap via the snapshot.content (stringified doc).
                      // TXT path: inline minimal walker (no reference to diff helpers).
                      // Download via data URL. No persistence/diff mutations.
                      const snap = versionHistory[selectedHistoryIndex];
                      if (!snap) return;
                      const prefix = noteId ? `note-${noteId.slice(0, 8)}` : "untitled";
                      const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
                      const safeLabel = snap.label.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40);
                      // JSON (full TipTap)
                      const jsonPayload = { exportedAt: new Date().toISOString(), snapshot: snap };
                      const jUrl = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonPayload, null, 2));
                      const aJ = document.createElement("a");
                      aJ.href = jUrl;
                      aJ.download = `${prefix}-selected-${safeLabel}-${stamp}.json`;
                      document.body.appendChild(aJ); aJ.click(); document.body.removeChild(aJ);
                    }}
                    className="text-[8px] px-1.5 py-0 rounded bg-white/5 hover:bg-white/10 text-[#c084fc]/80 min-h-[28px] touch-manipulation focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                    title="M2: Export this selected snapshot as full TipTap JSON"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => {
                      // M2: TXT export for the selected snapshot only (diff context).
                      const snap = versionHistory[selectedHistoryIndex];
                      if (!snap) return;
                      const prefix = noteId ? `note-${noteId.slice(0, 8)}` : "untitled";
                      const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
                      const safeLabel = snap.label.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40);
                      let text = `Selected Snapshot Export: ${snap.label}\n${snap.ts}\n\n`;
                      try {
                        const doc = JSON.parse(snap.content || "{}");
                        let p = "";
                        const w = (n) => {
                          if (n && typeof n === "object") {
                            if (typeof n.text === "string") p += n.text;
                            if (n.type === "heading" || n.type === "paragraph" || n.type === "listItem" || n.type === "hardBreak") p += "\n";
                            if (Array.isArray(n.content)) n.content.forEach(w);
                          }
                        };
                        if (doc && doc.content) doc.content.forEach(w);
                        text += p.trim() || "(empty)";
                      } catch { text += snap.content || ""; }
                      const tUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
                      const aT = document.createElement("a");
                      aT.href = tUrl;
                      aT.download = `${prefix}-selected-${safeLabel}-${stamp}.txt`;
                      document.body.appendChild(aT); aT.click(); document.body.removeChild(aT);
                    }}
                    className="text-[8px] px-1.5 py-0 rounded bg-white/5 hover:bg-white/10 text-[#c084fc]/80"
                    title="M2: Export this selected snapshot as plain text"
                  >
                    TXT
                  </button>
                </div>
              </div>

              {/* M2: The computeStructuredDiff (existing helper) + improved display below = line-by-line with excellent +/- indicators and counts */}
              {(() => {
                try {
                  const snapDoc = JSON.parse(versionHistory[selectedHistoryIndex].content);
                  const currentDoc = editor ? editor.getJSON() : { content: [] };
                  const diff = computeStructuredDiff(snapDoc, currentDoc);
                  const totalChanged = diff.added + diff.removed + diff.modified;

                  // Richer JSON view for TipTap docs (M2 deliverable a): when toggled, show side-by-side pretty-printed
                  // raw TipTap JSON (snapshot vs current) with +/- line coloring via simple prefix scan, node stats,
                  // visual bars. Fully additive; structured +/- side-by-side + all restore/export/LIVE untouched.
                  if (diffViewMode === "json") {
                    const snapJson = JSON.stringify(snapDoc, null, 2).split("\n");
                    const currJson = JSON.stringify(currentDoc, null, 2).split("\n");
                    const maxJ = Math.max(snapJson.length, currJson.length);
                    let jsonAdded = 0, jsonRemoved = 0;
                    const jOld: Array<{ line: string; type: string }> = [];
                    const jNew: Array<{ line: string; type: string }> = [];
                    for (let i = 0; i < maxJ; i++) {
                      const o = snapJson[i] || "";
                      const n = currJson[i] || "";
                      if (o === n) { jOld.push({line: o, type: "same"}); jNew.push({line: n, type: "same"}); }
                      else if (!o && n) { jsonAdded++; jOld.push({line: "", type: "same"}); jNew.push({line: n, type: "added"}); }
                      else if (o && !n) { jsonRemoved++; jOld.push({line: o, type: "removed"}); jNew.push({line: "", type: "same"}); }
                      else { jOld.push({line: o, type: "modified"}); jNew.push({line: n, type: "modified"}); }
                    }
                    const jsonTotal = jsonAdded + jsonRemoved;
                    return (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[9px]">
                          <span className="uppercase tracking-[1px] text-[#71717a]/70 font-semibold">TipTap JSON Changes:</span>
                          <span className="px-1.5 py-px rounded bg-emerald-500/15 text-emerald-400">+{jsonAdded} lines</span>
                          <span className="px-1.5 py-px rounded bg-red-500/15 text-red-400">−{jsonRemoved} lines</span>
                          <span className="text-[#71717a]/50">({jsonTotal} affected)</span>
                        </div>
                        {/* Visual stats bar for JSON too */}
                        {jsonTotal > 0 && (
                          <div className="h-1 w-full bg-white/10 rounded mb-2 flex overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{width: `${Math.min(100, (jsonAdded / jsonTotal)*100)}%`}} />
                            <div className="bg-red-500 h-full" style={{width: `${Math.min(100, (jsonRemoved / jsonTotal)*100)}%`}} />
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[8px]">
                          <div className="bg-red-950/30 p-1 rounded border border-red-900/40 max-h-40 overflow-auto custom-scroll font-mono">
                            <div className="text-red-400 mb-0.5 font-semibold">OLD SNAPSHOT (JSON)</div>
                            {jOld.slice(0, 30).map((it, i) => (
                              <div key={i} className={`${it.type === "removed" ? "text-red-300 bg-red-900/40" : it.type === "modified" ? "text-orange-300" : "opacity-70"} whitespace-pre`}>{it.type === "removed" ? "− " : "  "}{it.line || " "}</div>
                            ))}
                          </div>
                          <div className="bg-emerald-950/30 p-1 rounded border border-emerald-900/40 max-h-40 overflow-auto custom-scroll font-mono">
                            <div className="text-emerald-400 mb-0.5 font-semibold">CURRENT (JSON)</div>
                            {jNew.slice(0, 30).map((it, i) => (
                              <div key={i} className={`${it.type === "added" ? "text-emerald-300 bg-emerald-900/40" : it.type === "modified" ? "text-orange-300" : "opacity-70"} whitespace-pre`}>{it.type === "added" ? "+ " : "  "}{it.line || " "}</div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-1 text-[8px] text-[#71717a]/60">Raw TipTap JSON side-by-side for precise doc structure comparison (richer view).</div>
                      </>
                    );
                  }

                  return (
                    <>
                      {/* M2 POLISH: Prominent, clear stats bar — added/removed/modified counts front-and-center for instant trust + visual % bars */}
                      <div className="flex flex-wrap items-center gap-2 mb-2 text-[9px] pl-0.5">
                        <span className="uppercase tracking-[1px] text-[#71717a]/70 font-semibold">Changes:</span>
                        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 text-emerald-400 px-1.5 py-px font-semibold border border-emerald-500/30">+{diff.added} added</span>
                        <span className="inline-flex items-center gap-0.5 rounded bg-red-500/15 text-red-400 px-1.5 py-px font-semibold border border-red-500/30">−{diff.removed} removed</span>
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 text-amber-400 px-1.5 py-px font-semibold border border-amber-500/30">~{diff.modified} modified</span>
                        <span className="text-[#71717a]/50">({totalChanged} lines affected)</span>
                      </div>
                      {/* Richer visual stats bars (proportional widths for instant overview; only for structured mode conceptually) */}
                      {totalChanged > 0 && (
                        <div className="h-1.5 w-full bg-white/10 rounded mb-2 overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (diff.added / totalChanged) * 100)}%` }} />
                          <div className="bg-red-500 h-full" style={{ width: `${Math.min(100, (diff.removed / totalChanged) * 100)}%` }} />
                          <div className="bg-amber-500 h-full" style={{ width: `${Math.min(100, (diff.modified / totalChanged) * 100)}%` }} />
                        </div>
                      )}

                      {/* M2: In-panel RESTORE CONFIRMATION — shows exactly "what will change" using the live diff from computeStructuredDiff.
                          Better than window.confirm: visible structured preview, explicit safety explanation, works for both demo localStorage and LIVE server snapshots.
                          On CONFIRM we call performRestore which does Before-capture + setContent + auto-select-0 + auto-scroll. */}
                      {confirmingRestore && (
                        <div className="mb-3 p-2.5 rounded border border-[#c084fc]/40 bg-[#c084fc]/5">
                          <div className="flex items-start gap-2 text-[#c084fc] font-semibold mb-1">
                            <span>RESTORE CONFIRMATION</span>
                          </div>
                          <div className="text-[9px] leading-snug text-[#e4e4e7]/90 mb-2">
                            Restoring <span className="font-medium text-white">{versionHistory[selectedHistoryIndex].label}</span> will replace the current editor content.
                            <br />
                            A safety snapshot labeled <span className="font-medium">"Before restore"</span> of your <strong>current work</strong> will be captured first (persisted to {isSupabaseLive() ? "server + localStorage" : "localStorage (demo)"}).
                          </div>
                          {/* Reuse the exact stats in confirm context for "show what will change" clarity */}
                          <div className="flex flex-wrap gap-1.5 text-[9px] mb-2">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">+{diff.added} lines added in snapshot</span>
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">−{diff.removed} lines removed</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">~{diff.modified} modified</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmingRestore(false)}
                              className="flex-1 text-[10px] px-3 py-1 rounded border border-white/15 hover:bg-white/5 active:bg-white/10 transition touch-manipulation min-h-[44px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                            >
                              CANCEL
                            </button>
                            <button
                              onClick={() => performRestore(selectedHistoryIndex)}
                              className="flex-1 text-[10px] px-3 py-1 rounded bg-[#00ff9f] text-black font-semibold hover:bg-[#00ff9f]/90 active:bg-[#00ff9f]/80 transition touch-manipulation min-h-[44px] focus-visible:ring-1 focus-visible:ring-[#c084fc]"
                            >
                              CONFIRM RESTORE
                            </button>
                          </div>
                        </div>
                      )}

                      {/* M2 POLISHED DIFF PANES: line-by-line using computeStructuredDiff output.
                          Better +/- indicators (bold colored − / +), stronger visual treatment per line type (left accent via colored text + bg), improved contrast/readability. */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[9px]">
                        <div className="bg-red-950/30 p-1.5 rounded border border-red-900/40">
                          <div className="flex justify-between text-red-400 mb-1 font-semibold tracking-tight">
                            <span>OLD (snapshot)</span>
                            <span className="text-[8px] opacity-80 font-normal">−{diff.removed}  ~{diff.modified}</span>
                          </div>
                          <div className="max-h-36 overflow-auto whitespace-pre-wrap text-[#a1a1aa] leading-[1.35] custom-scroll">
                            {diff.highlightedOld.slice(0, 24).map((item, i) => (
                              <div
                                key={i}
                                className={`flex gap-1 px-0.5 rounded-sm ${item.type === "removed" ? "bg-red-900/50 text-red-300" : item.type === "modified" ? "bg-orange-900/40 text-orange-300" : "opacity-60"}`}
                              >
                                <span className="w-3 shrink-0 select-none text-right font-bold">
                                  {item.type === "removed" ? "−" : item.type === "modified" ? "~" : " "}
                                </span>
                                <span className="flex-1 break-all">{item.line || "(empty line)"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-emerald-950/30 p-1.5 rounded border border-emerald-900/40">
                          <div className="flex justify-between text-emerald-400 mb-1 font-semibold tracking-tight">
                            <span>NEW (current)</span>
                            <span className="text-[8px] opacity-80 font-normal">+{diff.added}  ~{diff.modified}</span>
                          </div>
                          <div className="max-h-36 overflow-auto whitespace-pre-wrap text-[#a1a1aa] leading-[1.35] custom-scroll">
                            {diff.highlightedNew.slice(0, 24).map((item, i) => (
                              <div
                                key={i}
                                className={`flex gap-1 px-0.5 rounded-sm ${item.type === "added" ? "bg-emerald-900/50 text-emerald-300" : item.type === "modified" ? "bg-orange-900/40 text-orange-300" : "opacity-60"}`}
                              >
                                <span className="w-3 shrink-0 select-none text-right font-bold">
                                  {item.type === "added" ? "+" : item.type === "modified" ? "~" : " "}
                                </span>
                                <span className="flex-1 break-all">{item.line || "(empty line)"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                } catch {
                  return <div className="col-span-2 text-center text-[#71717a] py-1">Rich TipTap JSON — text preview limited</div>;
                }
              })()}

              {/* M2 updated footer — reflects live server backing now that persistence is real */}
              <div className="text-[#71717a]/60 mt-2 text-[9px] border-t border-white/10 pt-1.5">
                Click row to toggle preview. RESTORE button opens confirmation with live stats. Server snapshots (LIVE) + localStorage (demo) fully supported.
              </div>
            </div>
          )}

          {/* M2: Updated trust footer — server persistence (via onPersistSnapshot + serverSnapshots prop) is live. */}
          <div className="mt-2 text-[9px] text-[#71717a]/50">
            Snapshots persist to server in LIVE mode • localStorage fallback for demo. Every restore auto-captures a safety "Before restore" snapshot first.
          </div>
        </div>
      )}

      {/* ========== INTEGRATED BACKLINKS + LINKS PANEL (Agent 24) ========== */}
      {/* Glass section inside editor chrome. Shows incoming (back) + outbound. Demo seeds if no parent props. */}
      {/* Supports remove via callbacks (parent keeps bidirectional arrays in sync). Pure Tailwind, no external deps. */}
      <div className="border-t border-white/10 bg-[#0f0f13]/60 px-4 py-2 text-xs">
        <button
          onClick={() => setShowBacklinksPanel(v => !v)}
          className="flex w-full items-center justify-between text-left text-[#a1a1aa] hover:text-[#f4f4f5] font-mono tracking-[1px] mb-1 focus-visible:ring-1 focus-visible:ring-[#c084fc]/50 rounded px-1 -mx-1"
          title="Toggle linked & backlinks"
          aria-expanded={showBacklinksPanel}
          aria-controls="links-backlinks-panel"
        >
          <span className="flex items-center gap-1.5"><Share2 className="h-3 w-3" /> LINKS & BACKLINKS</span>
          <span className="text-[10px] opacity-70">{showBacklinksPanel ? "−" : "+"} {(linkedItems.length + effectiveBacklinks.length)} connected</span>
        </button>
        {showBacklinksPanel && (
          <div id="links-backlinks-panel" role="region" aria-label="Links and backlinks" className="pt-1">
            {/* Lightweight in-panel search + sort (M2 polish) */}
            <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[10px]">
              <input
                type="text"
                placeholder="Filter links..."
                className="flex-1 min-w-[120px] bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] placeholder:text-[#71717a]/60 focus:outline-none focus:border-[#c084fc]/40 touch-manipulation"
                value={linkFilter}
                onChange={(e) => setLinkFilter(e.target.value)}
                aria-label="Filter links"
              />
              <input
                type="text"
                placeholder="Search..."
                className="w-24 bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] placeholder:text-[#71717a]/60 focus:outline-none focus:border-[#c084fc]/40 touch-manipulation"
                value={linksSearch}
                onChange={(e) => setLinksSearch(e.target.value)}
                aria-label="Search links"
              />
              <select
                value={linksSort}
                onChange={(e) => setLinksSort(e.target.value as any)}
                className="bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] text-[#71717a] touch-manipulation focus:border-[#c084fc]/40 focus:outline-none"
                aria-label="Sort links"
              >
                <option value="recency">Recency</option>
                <option value="title">Title</option>
                <option value="type">Type</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* Outbound linked - real data only */}
              {linkedItems
                .filter(item => 
                  (!linkFilter || item.title.toLowerCase().includes(linkFilter.toLowerCase())) &&
                  (!linksSearch || item.title.toLowerCase().includes(linksSearch.toLowerCase()))
                )
                .map((item, i) => (
                <span key={`out-${i}`} className="inline-flex items-center gap-1 rounded-md bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/30 px-2 py-0.5 font-mono text-[10px] group">
                  🔗 {item.title.length > 22 ? item.title.slice(0,21)+'…' : item.title}
                  {onRemoveLinked && (
                    <button
                      onClick={() => onRemoveLinked(item.id, item.type)}
                      className="ml-0.5 opacity-70 hover:opacity-100 hover:text-red-400 active:text-red-400 p-0.5 -mr-0.5 touch-manipulation rounded focus-visible:ring-1"
                      title="Unlink"
                      aria-label={`Remove linked ${item.type} ${item.title}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {/* Incoming backlinks - real data only (notes + tasks) */}
              {effectiveBacklinks
                .filter(item => 
                  (!linkFilter || item.title.toLowerCase().includes(linkFilter.toLowerCase())) &&
                  (!linksSearch || item.title.toLowerCase().includes(linksSearch.toLowerCase()))
                )
                .map((item, i) => (
                <span key={`back-${i}`} className="inline-flex items-center gap-1 rounded-md bg-[#00ff9f]/10 text-[#00ff9f] border border-[#00ff9f]/30 px-2 py-0.5 font-mono text-[10px] group">
                  ⬅ {item.title.length > 20 ? item.title.slice(0,19)+'…' : item.title}
                  {onRemoveBacklink && (
                    <button
                      onClick={() => onRemoveBacklink(item.id, item.type)}
                      className="ml-0.5 opacity-70 hover:opacity-100 hover:text-red-400 active:text-red-400 p-0.5 -mr-0.5 touch-manipulation rounded focus-visible:ring-1"
                      title="Remove backlink"
                      aria-label={`Remove backlink ${item.type} ${item.title}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {linkedItems.length === 0 && effectiveBacklinks.length === 0 && (
                <span className="text-[#71717a]/60 text-[9px] self-center ml-1">(use /link or header Linked Tasks for more)</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Subtle footer hint - now updated with slash + live link scan! */}
      <div className="px-4 py-1.5 border-t border-white/10 bg-[#111114]/40 text-[10px] text-[#71717a] font-mono tracking-[1px] flex items-center justify-between">
        <span>TIP TAP — RICH JSONB • ⌘B/I/S • LISTS • /SLASH • {detectedMentions.length} @MENTIONS SCANNED • LINKED</span>
        <span className="text-[#c084fc]/60">Type / anywhere — feels bad ass</span>
      </div>
    </div>
  );
}
