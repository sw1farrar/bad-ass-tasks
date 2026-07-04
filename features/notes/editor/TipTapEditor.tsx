"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
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
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Table2,
  Paperclip,
} from "lucide-react";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getBacklinkNotes } from "../hooks/useBacklinks";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { NoteImage } from "./extensions/note-image";
import { EmailHtmlBlock } from "./extensions/email-html-block";
import {
  fileToDataUrl,
  getClipboardImageFiles,
  getClipboardFiles,
  getDroppedImageFiles,
  getDroppedFiles,
} from "./lib/clipboard-images";
import { ListTabKeymap } from "@/lib/editor/listTabKeymap";

/** Default collapsed height before "Read more" (~12–14 lines at 15px/1.65). */
const NOTE_COLLAPSED_MAX_PX = 320;

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
  /** Optional slot rendered directly below the formatting toolbar */
  belowToolbar?: React.ReactNode;
  /** Compact icon-only toolbar for mobile drawer */
  compactToolbar?: boolean;
  /** Read-only preview — hides toolbar and disables editing */
  readOnly?: boolean;
  /** Title/meta rendered above toolbar inside sticky preview chrome (Files desktop preview). */
  previewHeader?: React.ReactNode;
  /** Pin header, toolbar, and belowToolbar; only the editor body scrolls (Files desktop preview). */
  stickyPreviewChrome?: boolean;
  /** Hide disabled formatting toolbar in read-only sticky preview (mobile file detail). */
  hideReadonlyPreviewToolbar?: boolean;
  /** Rendered above editor content inside the files preview scroll region (e.g. linked tasks). */
  aboveScrollContent?: React.ReactNode;
  /** Rendered below editor content inside the files preview scroll region. */
  belowScrollContent?: React.ReactNode;
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
  /** Upload dropped/pasted files as note attachments (Files capture/edit modal). */
  onAttachFiles?: (files: File[]) => void | Promise<void>;
  /** Show paperclip toolbar control wired to onAttachFiles. */
  showAttachFilesButton?: boolean;
  /** Notebook mode: simplified editor with list Tab keymap and no file/task embeds. */
  variant?: "full" | "notebook";
  /** Keep formatting toolbar visible while scrolling (notebook editor). */
  stickyToolbar?: boolean;
}

export function TipTapEditor({
  content = "",
  onChange,
  placeholder = "Start writing your note...",
  className,
  minHeight = "240px",
  belowToolbar,
  compactToolbar,
  readOnly = false,
  previewHeader,
  stickyPreviewChrome = false,
  hideReadonlyPreviewToolbar = false,
  aboveScrollContent,
  belowScrollContent,
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
  linkableItems,
  onMentionLinked,
  onMentionsChanged,
  onLinkNoteToNote,
  onOpenNote,
  notes = [],
  // M3 minimal drill (only addition in this file per ultra-narrow charter)
  onUpdateNote,
  onAttachFiles,
  showAttachFilesButton = false,
  variant = "full",
  stickyToolbar = false,
}: TipTapEditorProps) {
  const stickyChromeLayout = stickyPreviewChrome || stickyToolbar;
  const isNotebookVariant = variant === "notebook";
  const attachButtonVisible = showAttachFilesButton || isNotebookVariant;
  const imageButtonVisible = isNotebookVariant || !attachButtonVisible;
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
  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const attachFilesInputRef = useRef<HTMLInputElement>(null);
  const editorBodyRef = useRef<HTMLDivElement>(null);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const [collapsePortalTarget, setCollapsePortalTarget] = useState<HTMLElement | null>(null);
  const handleImageFilesRef = useRef<(files: FileList | File[]) => Promise<boolean>>(
    async () => false
  );
  const onAttachFilesRef = useRef(onAttachFiles);

  // Image preview (world-class lightbox for any image in the editor)
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);

  const openImagePreview = useCallback((src: string, alt?: string) => {
    setPreviewImage({ src, alt });
  }, []);

  const openImagePreviewRef = useRef(openImagePreview);
  useEffect(() => {
    openImagePreviewRef.current = openImagePreview;
  }, [openImagePreview]);

  const closeImagePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const closeSlashMenu = useCallback(() => {
    setShowSlashMenu(false);
    setSlashQuery("");
    setSlashPosition(null);
    setSelectedSlashIndex(0);
  }, []);

  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const isCompactToolbar = compactToolbar ?? isMobileViewport;

  const [detectedMentions, setDetectedMentions] = useState<
    Array<{ label: string; refType?: string; refId?: string | null }>
  >([]);
  const liveContentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLiveSendRef = useRef<number>(0);

  const editorExtensions = useMemo(() => {
    const base = [
      StarterKit.configure({
        link: false,
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          HTMLAttributes: { class: "notes-bullet-list" },
        },
        orderedList: {
          HTMLAttributes: { class: "notes-ordered-list" },
        },
        listItem: {
          HTMLAttributes: { class: "notes-list-item" },
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Start writing...",
        emptyEditorClass: "is-editor-empty",
      }),
      MentionMark,
      NoteImage,
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "notes-editor-table" },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-neon-purple underline underline-offset-2 hover:text-neon-purple-tint transition-colors",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ];

    if (isNotebookVariant) {
      return [...base, ListTabKeymap];
    }

    return [
      ...base,
      EmailHtmlBlock.configure({ noteId: noteId ?? "" }),
      TaskEmbed.configure({
        tasks,
        onOpenTask,
        onToggleStatus,
        onUpdateTask,
      }),
      DatabaseBlock.configure({
        tasks,
        notes,
        linkedItems,
        onOpenTask,
        onToggleStatus,
        onUpdateTask,
        onOpenNote,
      }),
      SyncedBlock.configure({
        notes,
        onOpenNote,
        onUpdateNote,
      }),
    ];
  }, [
    isNotebookVariant,
    placeholder,
    noteId,
    tasks,
    notes,
    linkedItems,
    onOpenTask,
    onToggleStatus,
    onUpdateTask,
    onOpenNote,
    onUpdateNote,
  ]);

  const editor = useEditor({
    // Client-only editor; avoid Next.js hydration warning and first-paint delay.
    immediatelyRender: true,
    extensions: editorExtensions,
    editable: !readOnly,
    content: prepareInitialContent(content),
    onCreate: ({ editor: createdEditor }) => {
      lastEmittedContentRef.current = JSON.stringify(createdEditor.getJSON());
    },
    onUpdate: ({ editor }) => {
      if (readOnly) return;
      // Emit clean stringified TipTap JSON for rich JSONB persistence.
      // Hybrid layer (noteContentToJson) detects & stores full doc in DB.
      // jsonToNoteContent + UI previews always extract readable plain text fallback.
      const richJson = editor.getJSON();
      const contentString = JSON.stringify(richJson);

      if (contentString === lastEmittedContentRef.current) return;

      // Record what we emit so the external-content effect can avoid echo
      lastEmittedContentRef.current = contentString;
      if (onChange) {
        queueMicrotask(() => onChange(contentString));
      }

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
      queueMicrotask(() => {
        setDetectedMentions((prev) => {
          if (JSON.stringify(scanned) === JSON.stringify(prev)) return prev;
          onMentionsChanged?.(scanned);
          return scanned;
        });
      });

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
        class: "focus:outline-none min-h-[inherit]",
      },
      handleClickOn: (_view, _pos, node, _nodePos, event) => {
        if (node.type.name === "image" && node.attrs.src) {
          event.preventDefault();
          openImagePreviewRef.current(
            node.attrs.src as string,
            (node.attrs.alt as string) || undefined
          );
          return true;
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        if (showSlashMenu && (event.key === "Escape" || event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          closeSlashMenu();
          return false;
        }
        return false;
      },

      handlePaste: (_view, event) => {
        const allFiles = getClipboardFiles(event.clipboardData);
        if (allFiles.length > 0) {
          const imageFiles = allFiles.filter((f) => f.type.startsWith("image/"));
          const otherFiles = allFiles.filter((f) => !f.type.startsWith("image/"));
          if (imageFiles.length > 0) {
            event.preventDefault();
            void handleImageFilesRef.current(imageFiles);
          }
          if (otherFiles.length > 0 && onAttachFilesRef.current) {
            event.preventDefault();
            void onAttachFilesRef.current(otherFiles);
          }
          if (imageFiles.length > 0 || otherFiles.length > 0) return true;
        }
        const imageFiles = getClipboardImageFiles(event.clipboardData);
        if (imageFiles.length > 0) {
          event.preventDefault();
          void handleImageFilesRef.current(imageFiles);
          return true;
        }
        return false;
      },

      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const allFiles = getDroppedFiles(event.dataTransfer);
        if (allFiles.length > 0) {
          const imageFiles = allFiles.filter((f) => f.type.startsWith("image/"));
          const otherFiles = allFiles.filter((f) => !f.type.startsWith("image/"));
          if (imageFiles.length > 0) {
            event.preventDefault();
            void handleImageFilesRef.current(imageFiles);
          }
          if (otherFiles.length > 0 && onAttachFilesRef.current) {
            event.preventDefault();
            void onAttachFilesRef.current(otherFiles);
          }
          if (imageFiles.length > 0 || otherFiles.length > 0) return true;
        }
        const imageFiles = getDroppedImageFiles(event.dataTransfer);
        if (imageFiles.length > 0) {
          event.preventDefault();
          void handleImageFilesRef.current(imageFiles);
          return true;
        }
        return false;
      },

      handleDOMEvents: {
        dragover: (_view, event) => {
          const types = event.dataTransfer?.types;
          if (types && Array.from(types).includes("Files")) {
            event.preventDefault();
          }
          return false;
        },
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
      // Defer setContent so TipTap's React node views don't call flushSync during render.
      queueMicrotask(() => {
        if (!editor || editor.isDestroyed) return;
        if (editor.isFocused) return;
        const latestInEditor = JSON.stringify(editor.getJSON());
        if (latestInEditor !== incoming && incoming !== lastEmittedContentRef.current) {
          // Note: we intentionally do NOT emit an update here to avoid feedback loops.
          // The content we are applying came from outside (store) and matches what we last saved.
          editor.commands.setContent(prepareInitialContent(incoming));
          lastEmittedContentRef.current = incoming;
        }
      });
    }
  }, [content, editor, noteId]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

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

  // Agent 30: live cursors support (debounce ref + overlay container)
  const lastCursorSendRef = useRef<number>(0);
  const cursorOverlayRef = useRef<HTMLDivElement>(null);

  // Keyboard accessibility for backlinks panel (Escape closes when open)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showBacklinksPanel) {
          setShowBacklinksPanel(false);
      }
    };
    if (showBacklinksPanel) {
      window.addEventListener("keydown", handleKey);
    }
    return () => window.removeEventListener("keydown", handleKey);
  }, [showBacklinksPanel]);

  // M2: Debounced auto content snapshots on typing
  const lastAutoSnapshotRef = useRef<number>(0);
  const autoSnapshotTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const closeLinkPicker = useCallback(() => {
    setShowLinkPicker(false);
    setLinkPickerPosition(null);
    setPendingLinkInsert(null);
    setLinkPickerSearch("");
  }, []);

  // Normalize parent linkableItems ({ title }) to picker shape ({ label })
  const normalizeLinkable = (item: { id: string; title?: string; label?: string; type: "task" | "note" | "external" }) => ({
    id: item.id,
    label: item.label ?? item.title ?? "Untitled",
    type: item.type,
  });

  // Real linkables when provided by parent (M2 bidirectional deepening), otherwise demo samples
  const linkables = (linkableItems && linkableItems.length > 0)
    ? [...linkableItems.map((item) => normalizeLinkable({ ...item, type: item.type })), { id: "custom", label: "Custom label...", type: "external" as const }]
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

    // Media (the amazing image experience the user asked for)
    {
      id: "image",
      title: "Image",
      description: "Upload, paste, or drop a photo (auto-scales beautifully)",
      icon: ImageIcon,
      keywords: ["photo", "picture", "upload", "img", "media", "paste image"],
      category: "Media",
      action: async () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.onchange = async () => {
          if (input.files) await handleImageFiles(input.files);
        };
        input.click();
      },
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
  ];

  const notebookExcludedSlashIds = useMemo(
    () =>
      new Set([
        "task",
        "note",
        "note-link",
        "db-block",
        "synced-block",
        "link",
        "checklist",
      ]),
    [],
  );

  const slashCommandsForVariant = useMemo(
    () =>
      isNotebookVariant
        ? slashCommandsBase.filter((cmd) => !notebookExcludedSlashIds.has(cmd.id))
        : slashCommandsBase,
    [isNotebookVariant, notebookExcludedSlashIds],
  );

  const filteredSlashCommands = useMemo(() => {
    const q = slashQuery.toLowerCase().trim();
    if (!q) return [...slashCommandsForVariant];
    // Enhanced scoring for better discoverability + search quality
    const scored = slashCommandsForVariant
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
  }, [slashQuery, slashCommandsForVariant]);

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

  // ========================================================================
  // AMAZING IMAGE SUPPORT — paste, drop, toolbar, /image, auto-scale, preview
  // ========================================================================

  // Insert an image into the editor at current selection.
  // Also triggers an immediate structural persist (so new images don't get lost on Enter/blur).
  const insertImage = useCallback(async (src: string, alt?: string) => {
    if (!editor) return;

    editor.chain().focus().setImage({ src, alt: alt || "Uploaded image" }).run();

    // Force a quick emit for structural image insert (ensures it persists immediately)
    const richJson = editor.getJSON();
    const contentString = JSON.stringify(richJson);
    lastEmittedContentRef.current = contentString;
    onChange?.(contentString);

    // Beautiful but calm toast (the real delight is the click-to-preview lightbox)
    toast.success("Image added", {
      description: "Click it for the full preview (zoom • pan • mobile swipe).",
      duration: 850,
    });
  }, [editor, onChange, noteId]);

  // Handle pasted or dropped image files (the core "accept uploaded files and view images" requirement)
  const handleImageFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return false;

    for (const file of imageFiles) {
      try {
        // For now: base64 (demo + instant). Later: upload to Supabase Storage and use the public URL.
        const dataUrl = await fileToDataUrl(file);
        await insertImage(dataUrl, file.name.replace(/\.[^/.]+$/, ""));
      } catch (e) {
        console.error("Image insert failed", e);
        toast.error("Couldn't add that image", { description: "Try a smaller file or different format." });
      }
    }
    return true;
  }, [insertImage]);

  useEffect(() => {
    handleImageFilesRef.current = handleImageFiles;
  }, [handleImageFiles]);

  useEffect(() => {
    onAttachFilesRef.current = onAttachFiles;
  }, [onAttachFiles]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl || "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [editor]);

  // Force-save on blur (when the user finishes typing a paragraph or thought and clicks away).
  // This is a key part of "reliable paragraph persistence" without hammering the DB on every keystroke.
  useEffect(() => {
    if (!editor) return;

    const handleBlur = () => {
      if (!noteId) return;
      const richJson = editor.getJSON();
      const contentString = JSON.stringify(richJson);

      // Only persist if it actually changed
      if (contentString !== lastEmittedContentRef.current) {
        lastEmittedContentRef.current = contentString;
        onChange?.(contentString);
      }
    };

    // TipTap's onBlur event
    editor.on("blur", handleBlur);

    return () => {
      editor.off("blur", handleBlur);
    };
  }, [editor, noteId, onChange]);

  // World-class image click-to-preview wiring (delegated, works for pasted + uploaded images)
  useEffect(() => {
    if (!editor) return;

    const handleImageClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest?.("img") as HTMLImageElement | null;
      if (!target?.getAttribute("src")) return;
      const src = target.getAttribute("src")!;
      const alt = target.getAttribute("alt") || undefined;
      e.preventDefault();
      e.stopPropagation();
      openImagePreview(src, alt);
    };

    // Attach to the actual ProseMirror DOM once available (guard: tests/mocks may omit view)
    const proseMirror = editor.view?.dom as HTMLElement | undefined;
    if (!proseMirror) return;
    proseMirror.addEventListener("click", handleImageClick, true);

    return () => {
      proseMirror.removeEventListener("click", handleImageClick, true);
    };
  }, [editor, openImagePreview]);

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

  useEffect(() => {
    setContentExpanded(false);
    setNeedsCollapse(false);
  }, [noteId]);

  useEffect(() => {
    const resolvePortalTarget = () => {
      const panel = editorBodyRef.current?.closest(
        ".notes-files-preview-body, .notes-editor-scroll-body, .notes-editor-panel, .notes-drawer-body",
      );
      setCollapsePortalTarget(panel instanceof HTMLElement ? panel : null);
    };
    resolvePortalTarget();
    requestAnimationFrame(resolvePortalTarget);
  }, [editor, noteId, contentExpanded]);

  useEffect(() => {
    if (!editor) return;

    const measureCollapse = () => {
      if (stickyChromeLayout) {
        setNeedsCollapse(false);
        return;
      }

      const prose = editorBodyRef.current?.querySelector(".ProseMirror");
      if (!prose) return;

      let hasEmailBlock = false;
      editor.state.doc.descendants((node) => {
        if (node.type.name === "emailHtmlBlock") {
          hasEmailBlock = true;
          return false;
        }
      });

      if (hasEmailBlock) {
        setNeedsCollapse(false);
        return;
      }

      setNeedsCollapse(prose.scrollHeight > NOTE_COLLAPSED_MAX_PX + 8);
    };

    const handleEditorFocus = () => setContentExpanded(true);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measureCollapse)
        : null;

    const scheduleMeasure = () => {
      requestAnimationFrame(() => {
        measureCollapse();
        const container = editorBodyRef.current;
        if (container && resizeObserver) {
          resizeObserver.observe(container);
        }
      });
    };

    scheduleMeasure();
    editor.on("update", measureCollapse);
    editor.on("focus", handleEditorFocus);

    return () => {
      editor.off("update", measureCollapse);
      editor.off("focus", handleEditorFocus);
      resizeObserver?.disconnect();
    };
  }, [editor, stickyChromeLayout]);

  const isContentCollapsed = needsCollapse && !contentExpanded && !stickyChromeLayout;

  if (!editor) {
    return (
      <div
        className={cn(
          "glass rounded-2xl border border-border-glass p-4",
          className
        )}
        style={{ minHeight }}
      >
        <div className="text-text-muted text-sm animate-pulse">Loading editor…</div>
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
        "flex shrink-0 items-center justify-center rounded-md transition-all active:scale-95",
        "hover:bg-black/5 border border-transparent touch-manipulation",
        isCompactToolbar ? "h-6 w-6 min-h-6 min-w-6 rounded-sm" : "h-9 w-9 rounded-lg",
        isActive
          ? "bg-neon-purple-dark/15 text-neon-purple-dark border-neon-purple-dark/30"
          : "text-[var(--note-canvas-text-muted,#71717a)] hover:text-[var(--note-canvas-text,#18181b)] hover:bg-black/5"
      )}
    >
      {children}
    </button>
  );

  const toolbarIconClass = isCompactToolbar ? "h-3 w-3" : "h-[18px] w-[18px]";
  const toolbarDividerClass = cn(
    "bg-[var(--note-canvas-border,rgba(24,24,27,0.12))] shrink-0",
    isCompactToolbar ? "w-px h-3 mx-0" : "w-px h-6 mx-0.5",
  );
  const toolbarGroupClass =
    "notes-editor-toolbar__group flex items-center gap-0.5 rounded-lg bg-black/[0.04] p-0.5 border border-black/[0.06]";
  const compactToolbarRowClass =
    "notes-editor-toolbar__row flex items-center flex-nowrap w-full";

  const showToolbar =
    (!readOnly || stickyPreviewChrome) && !(readOnly && hideReadonlyPreviewToolbar);
  const toolbarDisabled = readOnly && stickyPreviewChrome;

  const toolbarMarkup = showToolbar ? (
    isCompactToolbar ? (
      <div
        className={cn(
          "notes-editor-toolbar notes-editor-toolbar--compact border-b border-[var(--note-canvas-border,rgba(24,24,27,0.1))] bg-[var(--note-canvas-surface,#f0f0ed)] flex flex-col gap-0 px-0.5 py-0.5",

          toolbarDisabled && "notes-editor-toolbar--readonly pointer-events-none select-none opacity-80",
        )}
        aria-hidden={toolbarDisabled || undefined}
      >
        <div className={cn(compactToolbarRowClass, "notes-editor-toolbar__row--primary justify-between gap-0")}>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            title="Bold (⌘B)"
          >
            <Bold className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            title="Italic (⌘I)"
          >
            <Italic className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive("strike")}
            title="Strikethrough"
          >
            <span className="text-[9px] font-bold leading-none line-through">S</span>
          </ToolbarButton>
          <div className={toolbarDividerClass} />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className={toolbarIconClass} />
          </ToolbarButton>
        </div>
        <div className={cn(compactToolbarRowClass, "notes-editor-toolbar__row--secondary justify-between gap-0")}>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            title="Bullet List"
          >
            <List className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            title="Numbered List"
          >
            <ListOrdered className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")}
            title="Blockquote"
          >
            <Quote className={toolbarIconClass} />
          </ToolbarButton>
          <div className={toolbarDividerClass} />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive("codeBlock")}
            title="Code Block"
          >
            <Code className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={applyLink}
            isActive={editor.isActive("link")}
            title="Insert link"
          >
            <Link2 className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            isActive={editor.isActive("table")}
            title="Insert table"
          >
            <Table2 className={toolbarIconClass} />
          </ToolbarButton>
          <div className={toolbarDividerClass} />
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            isActive={false}
            title="Undo (⌘Z)"
          >
            <Undo2 className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            isActive={false}
            title="Redo (⌘⇧Z)"
          >
            <Redo2 className={toolbarIconClass} />
          </ToolbarButton>
          {imageButtonVisible && (
            <ToolbarButton
              onClick={() => imageUploadInputRef.current?.click()}
              isActive={false}
              title="Insert image (paste or drag & drop also work)"
            >
              <ImageIcon className={toolbarIconClass} />
            </ToolbarButton>
          )}
          {attachButtonVisible && (
            <ToolbarButton
              onClick={() => attachFilesInputRef.current?.click()}
              isActive={false}
              title="Attach file (drag & drop into the note also works)"
            >
              <Paperclip className={toolbarIconClass} />
            </ToolbarButton>
          )}
        </div>
      </div>
    ) : (
      <div
        className={cn(
          "notes-editor-toolbar notes-editor-toolbar--full flex items-center gap-2 border-b border-[var(--note-canvas-border,rgba(24,24,27,0.1))] bg-[var(--note-canvas-surface,#f0f0ed)] px-4 py-2.5 flex-wrap",
          toolbarDisabled && "notes-editor-toolbar--readonly pointer-events-none select-none opacity-80",
        )}
        aria-hidden={toolbarDisabled || undefined}
      >
        <div className={toolbarGroupClass}>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            title="Bold (⌘B)"
          >
            <Bold className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            title="Italic (⌘I)"
          >
            <Italic className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive("strike")}
            title="Strikethrough"
          >
            <span className="text-sm font-bold line-through">S</span>
          </ToolbarButton>
        </div>
        <div className={toolbarGroupClass}>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className={toolbarIconClass} />
          </ToolbarButton>
        </div>
        <div className={toolbarGroupClass}>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            title="Bullet List"
          >
            <List className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            title="Numbered List"
          >
            <ListOrdered className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")}
            title="Blockquote"
          >
            <Quote className={toolbarIconClass} />
          </ToolbarButton>
        </div>
        <div className={toolbarGroupClass}>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive("codeBlock")}
            title="Code Block"
          >
            <Code className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={applyLink}
            isActive={editor.isActive("link")}
            title="Insert link"
          >
            <Link2 className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            isActive={editor.isActive("table")}
            title="Insert table"
          >
            <Table2 className={toolbarIconClass} />
          </ToolbarButton>
          {imageButtonVisible && (
            <ToolbarButton
              onClick={() => imageUploadInputRef.current?.click()}
              isActive={false}
              title="Insert image (paste or drag & drop also work)"
            >
              <ImageIcon className={toolbarIconClass} />
            </ToolbarButton>
          )}
          {attachButtonVisible && (
            <ToolbarButton
              onClick={() => attachFilesInputRef.current?.click()}
              isActive={false}
              title="Attach file (drag & drop into the note also works)"
            >
              <Paperclip className={toolbarIconClass} />
            </ToolbarButton>
          )}
        </div>
        <div className={toolbarGroupClass}>
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            isActive={false}
            title="Undo (⌘Z)"
          >
            <Undo2 className={toolbarIconClass} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            isActive={false}
            title="Redo (⌘⇧Z)"
          >
            <Redo2 className={toolbarIconClass} />
          </ToolbarButton>
        </div>
      </div>
    )
  ) : null;

  const chromeBlock = stickyChromeLayout ? (
    previewHeader || toolbarMarkup || belowToolbar ? (
      <div
        className={cn(
          stickyPreviewChrome ? "notes-files-preview-chrome" : "notes-editor-sticky-chrome",
        )}
      >
        {stickyPreviewChrome ? previewHeader : null}
        {toolbarMarkup}
        {belowToolbar}
      </div>
    ) : null
  ) : (
    <>
      {toolbarMarkup}
      {belowToolbar}
    </>
  );

  const editorBody = (
      <div
        className={cn(
          "bg-[var(--note-canvas-bg,#f8f8f6)] relative",
          isCompactToolbar ? "notes-editor-body py-3 px-0" : "p-5",
          needsCollapse && contentExpanded && (isCompactToolbar ? "pb-16" : "pb-20"),
        )}
        style={{
          minHeight:
            isContentCollapsed || (stickyChromeLayout && readOnly)
              ? undefined
              : minHeight,
        }}
        onClick={() => {
          if (!readOnly) editor.chain().focus().run();
        }}
      >
        <div
          ref={editorBodyRef}
          className={cn("relative", isContentCollapsed && "note-content-collapsed")}
          style={
            isContentCollapsed
              ? { maxHeight: NOTE_COLLAPSED_MAX_PX }
              : undefined
          }
        >
          <EditorContent editor={editor} />

          {isContentCollapsed && (
            <>
              <div
                className="note-content-collapsed-fade pointer-events-none absolute inset-x-0 bottom-0 h-20"
                aria-hidden
              />
              <div className="absolute inset-x-0 bottom-0 flex justify-center pb-1 pt-6">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContentExpanded(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--note-canvas-border,rgba(24,24,27,0.14))] bg-white px-3 py-1.5 text-xs font-medium text-[var(--note-canvas-text-secondary,#52525b)] shadow-sm transition-colors hover:border-neon-purple-dark/35 hover:text-neon-purple-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/50"
                >
                  Read more
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </>
          )}
        </div>

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
            className="absolute z-50 w-72 glass rounded-xl border border-border-glass shadow-2xl overflow-hidden py-1 text-sm"
            style={{
              top: `${slashPosition.top}px`,
              left: `${slashPosition.left}px`,
              maxHeight: "260px",
              overflowY: "auto",
            }}
          >
            <div className="px-3 py-1.5 text-[10px] font-mono tracking-[1.5px] text-text-muted border-b border-border-glass flex items-center gap-2">
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
              const categoryOrder = ["Formatting", "Lists & Structure", "Smart Embeds & Actions", "Other"];
              let flatIdx = 0; // for global selection index across groups
              return categoryOrder.filter(c => groups[c]).flatMap(cat => {
                const cmdsInCat = groups[cat];
                const header = (
                  <div key={`${cat}-header`} className="px-3 py-1 text-[9px] uppercase tracking-[1px] text-neon-purple/70 bg-surface-hover font-mono border-y border-border-glass">
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
                          ? "bg-neon-purple/15 text-text-primary border-l-2 border-neon-purple"
                          : "hover:bg-surface-hover text-text-secondary hover:text-text-primary"
                      )}
                    >
                      <div className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
                        isSelected ? "bg-neon-purple/20 text-neon-purple" : "bg-surface-hover text-text-muted"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[13px] tracking-tight">{cmd.title}</div>
                        <div className="text-[11px] text-text-muted truncate">{cmd.description}</div>
                      </div>
                      {isSelected && (
                        <div className="text-[10px] text-neon-purple font-mono">⏎</div>
                      )}
                    </button>
                  );
                });
                return [header, ...items];
              });
            })()}
            <div className="px-3 py-1 text-[9px] text-text-muted/70 border-t border-border-glass font-mono tracking-widest">
              ↑↓ navigate • ⏎ / Tab select • 1-9 quick pick • ⎋ close • type to filter • categories for discoverability
            </div>
          </div>
        )}
        {/* Fallback empty state for slash */}
        {showSlashMenu && filteredSlashCommands.length === 0 && slashPosition && (
          <div
            ref={slashMenuRef}
            className="absolute z-50 w-64 glass rounded-xl border border-border-glass p-3 text-xs text-text-muted"
            style={{ top: `${slashPosition.top}px`, left: `${slashPosition.left}px` }}
          >
            No commands match “{slashQuery}”. Try{" "}
            {isNotebookVariant ? "/heading, /image, /table, /quote…" : "/heading, /task, /embed…"}
          </div>
        )}

        {/* ========== MAGICAL IN-EDITOR LINK PICKER (Agent 24 bidirectional linking) ========== */}
        {showLinkPicker && linkPickerPosition && (
          <div
            ref={linkPickerRef}
            className="absolute z-[60] w-64 glass rounded-xl border border-border-glass shadow-2xl overflow-hidden py-1 text-sm"
            style={{
              top: `${linkPickerPosition.top}px`,
              left: `${linkPickerPosition.left}px`,
            }}
          >
            <div className="px-3 py-1.5 text-[10px] font-mono tracking-[1.5px] text-text-muted border-b border-border-glass flex items-center gap-2">
              <Share2 className="h-3 w-3" /> BIDIR LINK PICKER • choose to insert neon mention
            </div>
            <input
              type="text"
              placeholder="Filter notes & tasks..."
              value={linkPickerSearch}
              onChange={(e) => setLinkPickerSearch(e.target.value)}
              className="mx-3 my-1 w-[calc(100%-24px)] text-xs bg-bg-secondary border border-border-glass rounded px-2 py-1 focus:outline-none focus:border-neon-purple/40"
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
                  <div className="px-3 pt-2 pb-1 text-[9px] font-mono uppercase tracking-widest text-text-muted">{title}</div>
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover text-text-secondary hover:text-text-primary border-l-2 border-transparent hover:border-neon-purple/50 transition"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-surface-hover text-neon-purple text-xs shrink-0">
                        {item.type === "task" ? "✅" : item.type === "note" ? "📝" : "🔗"}
                      </div>
                      <span className="font-medium text-[13px] truncate flex-1">{item.label}</span>
                      <span className="text-[9px] text-text-muted font-mono uppercase tracking-widest">{item.type}</span>
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
            <div className="px-3 py-1 text-[9px] text-text-muted/70 border-t border-border-glass font-mono tracking-widest">
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
            className="absolute z-[60] w-72 glass rounded-xl border border-border-glass shadow-2xl overflow-hidden py-1 text-sm"
            style={{
              top: `${syncedBlockPickerPosition.top}px`,
              left: `${syncedBlockPickerPosition.left}px`,
            }}
          >
            <div className="px-3 py-1.5 text-[10px] font-mono tracking-[1.5px] text-text-muted border-b border-border-glass flex items-center gap-2">
              <FileText className="h-3 w-3" /> SYNCED BLOCK • pick another note for live reference
            </div>
            <input
              type="text"
              placeholder="Filter other notes..."
              value={syncedBlockPickerSearch}
              onChange={(e) => setSyncedBlockPickerSearch(e.target.value)}
              className="mx-3 my-1 w-[calc(100%-24px)] text-xs bg-bg-secondary border border-border-glass rounded px-2 py-1 focus:outline-none focus:border-neon-purple/40"
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
                    <div className="px-3 py-4 text-[12px] text-text-muted">
                      No matching notes. {syncedBlockNoteCandidates.length === 0 ? "Create additional notes to enable cross-note syncing." : "Try a different filter."}
                    </div>
                  );
                }

                return filtered.slice(0, 10).map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => insertSyncedBlockFromPicker(note)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover text-text-secondary hover:text-text-primary border-l-2 border-transparent hover:border-neon-purple/50 transition active:bg-surface-hover"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-surface-hover text-neon-purple text-xs shrink-0">
                      📝
                    </div>
                    <span className="font-medium text-[13px] truncate flex-1">{note.title}</span>
                    <span className="text-[9px] text-text-muted font-mono uppercase tracking-widest">NOTE</span>
                  </button>
                ));
              })()}
            </div>
            <div className="px-3 py-1 text-[9px] text-text-muted/70 border-t border-border-glass font-mono tracking-widest">
              Click a note → inserts SyncedBlock with targetNoteId + title (live mirror)
            </div>
          </div>
        )}
      </div>
  );

  return (
    <div
      className={cn(
        "notes-rich-editor w-full flex flex-col bg-transparent",
        stickyPreviewChrome && "notes-rich-editor--files-preview flex-1 min-h-0",
        stickyToolbar && !stickyPreviewChrome && "notes-rich-editor--sticky-chrome flex-1 min-h-0",
        className,
      )}
    >
      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-hidden
        onChange={async (e) => {
          if (e.target.files?.length) {
            await handleImageFiles(e.target.files);
          }
          e.target.value = "";
        }}
      />
      <input
        ref={attachFilesInputRef}
        type="file"
        multiple
        className="hidden"
        aria-hidden
        onChange={async (e) => {
          if (e.target.files?.length && onAttachFilesRef.current) {
            await onAttachFilesRef.current(Array.from(e.target.files));
          }
          e.target.value = "";
        }}
      />
      {chromeBlock}

      {stickyChromeLayout ? (
        <div
          className={cn(
            "flex flex-1 flex-col min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain",
            stickyPreviewChrome ? "notes-files-preview-body" : "notes-editor-scroll-body",
          )}
        >
          {aboveScrollContent}
          {editorBody}
          {belowScrollContent}
        </div>
      ) : (
        editorBody
      )}

      {/* (Version History + all related code fully removed for lighter app + DB) */

/* World-class image lightbox — opens on any image click inside the editor (paste, drop, or future upload) */}
      <ImagePreviewModal
        src={previewImage?.src ?? null}
        alt={previewImage?.alt}
        onClose={closeImagePreview}
      />

      {needsCollapse &&
        contentExpanded &&
        !stickyChromeLayout &&
        collapsePortalTarget &&
        createPortal(
          <div
            className="note-read-less-dock pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pt-10"
            aria-hidden={false}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setContentExpanded(false);
                editorBodyRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
              className="note-read-less-btn pointer-events-auto inline-flex items-center gap-1 rounded-full border border-[var(--note-canvas-border,rgba(24,24,27,0.14))] bg-white/95 px-3 py-1.5 text-xs font-medium text-[var(--note-canvas-text-secondary,#52525b)] shadow-[0_4px_20px_rgba(0,0,0,0.12)] backdrop-blur-sm transition-colors hover:border-neon-purple-dark/35 hover:text-neon-purple-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/50"
            >
              Read less
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>,
          collapsePortalTarget,
        )}
    </div>
  );
}
