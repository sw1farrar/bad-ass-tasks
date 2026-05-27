"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Mark } from "@tiptap/core";  // Node imported only for future custom embeds (unused now to avoid DOM Node shadowing in handlers)
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
import { aiTransformText, aiTransformTextAI, isXAIConfigured } from "@/lib/utils";
import { toast } from "sonner";
import { isSupabaseLive } from "@/lib/data/hybridStore";

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
 * - **Slash commands**: Magical Notion-style / menu with keyboard nav (↑↓⏎⎋Tab), live scoring filter, icons + CATEGORIES (Formatting / Lists / Smart Embeds / Utils) for discoverability.
 *   Supports /heading, /list, /task, /note, /embed, /divider, /quote, etc. + custom actions. Grouped sections in floating glass.
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
  // Agent 30: Live cursors / selection sharing (builds on presence broadcast; premium Figma-like feel)
  remoteCursors?: Array<{ userId: string; email?: string; from: number; to: number; color?: string }>;
  onCursorUpdate?: (from: number, to: number) => void;
  /** Live collab: called (debounced) with the latest stringified TipTap JSON while the user is typing */
  onLiveContent?: (content: string) => void;
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
    ],
    content: prepareInitialContent(content),
    onUpdate: ({ editor }) => {
      // Emit clean stringified TipTap JSON for rich JSONB persistence.
      // Hybrid layer (noteContentToJson) detects & stores full doc in DB.
      // jsonToNoteContent + UI previews always extract readable plain text fallback.
      const richJson = editor.getJSON();
      const contentString = JSON.stringify(richJson);
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

  // ========== BIDIRECTIONAL LINK PICKER STATE (Agent 24) ==========
  // In-editor floating glass picker for /link & /note-link — delightful, sample-driven for demo, zero deps.
  // Supports task/note types for visual pills + future real ID resolution + backlink sync.
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkPickerPosition, setLinkPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [pendingLinkInsert, setPendingLinkInsert] = useState<{ deleteFrom: number; deleteTo: number } | null>(null);
  const linkPickerRef = useRef<HTMLDivElement>(null);

  // Detected mentions from live content scan (for backlinks prep, counts, future auto-sync)
  const [detectedMentions, setDetectedMentions] = useState<Array<{ label: string; refType?: string; refId?: string | null }>>([]);

  // Collapsible integrated backlinks panel state (always delightful demo if no props passed)
  const [showBacklinksPanel, setShowBacklinksPanel] = useState(true);

  // Light version history (Agent 24) — client snapshots only, survives via localStorage when noteId provided. Demo perfect.
  const [versionHistory, setVersionHistory] = useState<Array<{ ts: string; content: string; label: string }>>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Agent 30: live cursors support (debounce ref + overlay container)
  const lastCursorSendRef = useRef<number>(0);
  const cursorOverlayRef = useRef<HTMLDivElement>(null);

  // Live collab: refs for throttled + trailing live content broadcasts
  const liveContentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLiveSendRef = useRef<number>(0);

  const closeLinkPicker = useCallback(() => {
    setShowLinkPicker(false);
    setLinkPickerPosition(null);
    setPendingLinkInsert(null);
  }, []);

  // Sample linkables for magical demo UX (real parent data wired later via props/callbacks)
  const sampleLinkables = [
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
    // Basic toast for delight (real bidirectional handled in parent via future onLinkDetected)
    toast.success(`Linked ${refType}`, { description: item.label, duration: 1600 });
  }, [editor, pendingLinkInsert, closeLinkPicker]);

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
      title: "Task",
      description: "Insert task embed or quick-create",
      icon: CheckSquare,
      keywords: ["todo", "action", "checkbox", "p0"],
      category: "Smart Embeds & Actions",
      action: () => {
        const { from } = editor?.state.selection || { from: 0 };
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));
        editor?.chain().focus().deleteRange({ from: deleteStart, to: from }).insertContent({
          type: "paragraph",
          attrs: { "data-embed": "task", "data-placeholder": "true", class: "task-embed-placeholder" },
          content: [
            { type: "text", text: "✅  " },
            { type: "text", text: "Task Embed: ", marks: [{ type: "bold" }] },
            { type: "text", text: "Click header →Task or use /task to create & auto-link (data attrs ready for live card)", marks: [{ type: "italic" }] },
          ],
        }).run();
        // Parent can wire real creation via optional prop
        onCreateTaskFromSlash?.("Quick task from slash");
      },
    },
    {
      id: "note",
      title: "Note Embed",
      description: "Reference another note",
      icon: FileText,
      keywords: ["embed", "reference", "page"],
      category: "Smart Embeds & Actions",
      action: () => {
        const { from } = editor?.state.selection || { from: 0 };
        const deleteStart = Math.max(0, from - (slashQuery.length + 1));
        editor?.chain().focus().deleteRange({ from: deleteStart, to: from }).insertContent({
          type: "paragraph",
          attrs: { "data-embed": "note", class: "note-embed-placeholder" },
          content: [
            { type: "text", text: "📝  " },
            { type: "text", text: "Note Embed: ", marks: [{ type: "bold" }] },
            { type: "text", text: "Use /note-link for bidirectional [[ref]] with neon pill + backlinks panel (attrs for future live preview)", marks: [{ type: "italic" }] },
          ],
        }).run();
        onCreateNoteFromSlash?.();
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
        // /query already cleaned by executeSlashCommand; insert at current caret
        const { from } = editor.state.selection;
        openLinkPicker(from, from);
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
    // Utilities & Future
    {
      id: "ai",
      title: "AI Assist",
      description: "Rewrite / expand / summarize / tone (Agent 15)",
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

  // Light history helpers (local only)
  const captureSnapshot = useCallback((label?: string) => {
    if (!editor) return;
    const jsonStr = JSON.stringify(editor.getJSON());
    const ts = new Date().toISOString();
    const newSnap = { ts, content: jsonStr, label: label || `Snapshot ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` };
    const updated = [newSnap, ...versionHistory].slice(0, 8); // cap at 8
    setVersionHistory(updated);
    if (noteId && typeof window !== "undefined") {
      // Persist always for excellent demo UX; in live mode it's extra client cache (hybrid guards DB writes)
      try { localStorage.setItem(`note-history-${noteId}`, JSON.stringify(updated)); } catch {}
    }
    const mode = isSupabaseLive() ? "LIVE" : "DEMO";
    toast.success("Snapshot captured", { description: `${newSnap.label} (${mode})` });
  }, [editor, versionHistory, noteId]);

  // Load persisted history on mount (demo/light persist)
  useEffect(() => {
    if (!noteId || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`note-history-${noteId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setVersionHistory(parsed.slice(0,8));
      }
    } catch {}
  }, [noteId]);

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
      }
    };
    // Attach via editor view if possible (simplified)
    const dom = editor.view?.dom;
    if (dom) dom.addEventListener("blur", handleBlur, { once: true });
    return () => { if (dom) dom.removeEventListener("blur", handleBlur); };
  }, [editor, noteId, versionHistory.length]);

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
    };
  }, [editor]);

  // Live collab: apply incoming content updates from other clients (only when we are not actively typing)
  useEffect(() => {
    if (!editor || !content) return;
    if (editor.isFocused) return; // don't overwrite what the local user is typing

    console.log('[live-collab] TipTap applying remote content for note');

    try {
      const incoming = typeof content === 'string' ? JSON.parse(content) : content;
      const current = editor.getJSON();

      // Simple deep compare avoidance – only set if structure looks different
      if (JSON.stringify(current) !== JSON.stringify(incoming)) {
        editor.commands.setContent(incoming, false); // false = don't trigger onUpdate
      }
    } catch {
      // fallback: just set as-is
      editor.commands.setContent(prepareInitialContent(content), false);
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
        "glass rounded-2xl border border-white/10 overflow-hidden flex flex-col",
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
              const categoryOrder = ["Formatting", "Lists & Structure", "Smart Embeds & Actions", "Utilities & AI", "Other"];
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
            {sampleLinkables.map((item, idx) => (
              <button
                key={idx}
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
            <div className="px-3 py-1 text-[9px] text-[#71717a]/70 border-t border-white/10 font-mono tracking-widest">
              Click to insert typed @mention pill • supports task/note • foundation for real backlinks
            </div>
          </div>
        )}
      </div>

      {/* Light inline history panel (when toggled via toolbar) */}
      {showHistoryPanel && (
        <div className="border-t border-white/10 bg-[#111114]/70 px-4 py-2 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono tracking-widest text-[#c084fc]/80 flex items-center gap-1"><History className="h-3 w-3"/> VERSION HISTORY (light, local{ noteId ? ` • ${noteId.slice(0,6)}` : "" })</span>
            <button onClick={() => { captureSnapshot(); }} className="text-[10px] px-1.5 py-px rounded border border-white/20 hover:bg-white/5">+ SNAPSHOT</button>
            <button onClick={() => setShowHistoryPanel(false)} className="text-[10px] opacity-70 hover:opacity-100">CLOSE</button>
          </div>
          {versionHistory.length === 0 ? (
            <div className="text-[#71717a] text-[10px]">No snapshots yet. Use toolbar History or auto on first blur.</div>
          ) : (
            <div className="max-h-24 overflow-auto space-y-1 pr-1">
              {versionHistory.map((snap, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1 font-mono text-[10px]">
                  <span className="truncate flex-1 text-[#a1a1aa]">{snap.label} — {new Date(snap.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
                  <button
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(snap.content);
                        if (parsed && parsed.type === "doc") {
                          editor?.chain().focus().setContent(parsed).run();
                          toast.success("Restored snapshot");
                          setShowHistoryPanel(false);
                        }
                      } catch { toast.error("Restore failed"); }
                    }}
                    className="text-[#00ff9f] hover:underline text-[9px]"
                  >
                    RESTORE
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="text-[#71717a]/50 text-[9px] mt-1">JSONB ready • snapshots client-side (demo persists via localStorage when noteId passed)</div>
        </div>
      )}

      {/* ========== INTEGRATED BACKLINKS + LINKS PANEL (Agent 24) ========== */}
      {/* Glass section inside editor chrome. Shows incoming (back) + outbound. Demo seeds if no parent props. */}
      {/* Supports remove via callbacks (parent keeps bidirectional arrays in sync). Pure Tailwind, no external deps. */}
      <div className="border-t border-white/10 bg-[#0f0f13]/60 px-4 py-2 text-xs">
        <button
          onClick={() => setShowBacklinksPanel(v => !v)}
          className="flex w-full items-center justify-between text-left text-[#a1a1aa] hover:text-[#f4f4f5] font-mono tracking-[1px] mb-1"
          title="Toggle linked & backlinks"
        >
          <span className="flex items-center gap-1.5"><Share2 className="h-3 w-3" /> LINKS & BACKLINKS</span>
          <span className="text-[10px] opacity-70">{showBacklinksPanel ? "−" : "+"} {(linkedItems.length + (backlinks.length || 2))} connected</span>
        </button>
        {showBacklinksPanel && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {/* Outbound linked */}
            {(linkedItems.length > 0 ? linkedItems : [{id:"demo-out-1", title: "Related Task (demo)", type:"task" as const}]).map((item, i) => (
              <span key={`out-${i}`} className="inline-flex items-center gap-1 rounded-md bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/30 px-2 py-0.5 font-mono text-[10px] group">
                🔗 {item.title.length > 22 ? item.title.slice(0,21)+'…' : item.title}
                {onRemoveLinked && (
                  <button onClick={() => onRemoveLinked(item.id, item.type)} className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-400" title="Unlink">×</button>
                )}
              </span>
            ))}
            {/* Incoming backlinks */}
            {(backlinks.length > 0 ? backlinks : (detectedMentions.length ? detectedMentions.slice(0,2).map(m => ({id: String(m.refId||'d'), title: m.label||'Backlinked', type: (m.refType==='task'?'task':'note') as any })) : [{id:"demo-back-1", title: "Strategy Note (backlink demo)", type:"note" as const}])).map((item, i) => (
              <span key={`back-${i}`} className="inline-flex items-center gap-1 rounded-md bg-[#00ff9f]/10 text-[#00ff9f] border border-[#00ff9f]/30 px-2 py-0.5 font-mono text-[10px] group">
                ⬅ {item.title.length > 20 ? item.title.slice(0,19)+'…' : item.title}
                {onRemoveBacklink && (
                  <button onClick={() => onRemoveBacklink(item.id, item.type)} className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-400" title="Remove backlink">×</button>
                )}
              </span>
            ))}
            <span className="text-[#71717a]/60 text-[9px] self-center ml-1">(use /link or header +LINK for more • panel lives in editor)</span>
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
