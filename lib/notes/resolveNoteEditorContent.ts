import type { Note } from "@/types";
import { EMAIL_PIPELINE_VERSION } from "@/lib/notes/emailPipeline";
import { prepareInboundEmailHtml } from "@/lib/notes/sanitizeInboundEmailHtml";

type TipTapDoc = {
  type: string;
  content?: unknown[];
};

function tryParseTipTapDoc(content: string): TipTapDoc | null {
  const trimmed = (content ?? "").trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as TipTapDoc;
    if (parsed?.type === "doc") return parsed;
  } catch {
    // fall through
  }
  return null;
}

type EmailHtmlBlockAttrs = {
  html?: string;
  styles?: string;
  pipelineVersion?: number | null;
};

function findEmailHtmlBlock(
  doc: TipTapDoc,
): { attrs: EmailHtmlBlockAttrs } | null {
  const walk = (nodes: unknown[]): { attrs: EmailHtmlBlockAttrs } | null => {
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const n = node as {
        type?: string;
        attrs?: EmailHtmlBlockAttrs;
        content?: unknown[];
      };
      if (n.type === "emailHtmlBlock") {
        return { attrs: n.attrs ?? {} };
      }
      if (Array.isArray(n.content)) {
        const nested = walk(n.content);
        if (nested) return nested;
      }
    }
    return null;
  };
  return Array.isArray(doc.content) ? walk(doc.content) : null;
}

/** True when stored block html is missing or clearly truncated vs archived source. */
function emailHtmlBlockNeedsRebuild(
  block: { attrs: EmailHtmlBlockAttrs } | null,
  rawHtml: string,
): boolean {
  if (!block) return true;
  const blockHtml = (block.attrs.html ?? "").trim();
  if (!blockHtml) return true;

  const raw = rawHtml.trim();
  if (!raw) return false;

  // Legacy rows sometimes persisted an empty or stub block while raw_html stayed complete.
  if (raw.length > blockHtml.length * 1.25 && blockHtml.length < 280) {
    return true;
  }

  return false;
}

function emailHtmlBlockNode(
  html: string,
  styles: string,
  pipelineVersion?: number | null,
) {
  return {
    type: "emailHtmlBlock",
    attrs: {
      html,
      styles,
      pipelineVersion: pipelineVersion ?? EMAIL_PIPELINE_VERSION,
    },
  };
}

export function isInboundEmailNote(
  note: Pick<Note, "tags" | "recordType">,
): boolean {
  return note.recordType === "email" || (note.tags ?? []).includes("from-email");
}

/**
 * Ensures inbound email notes include an emailHtmlBlock for faithful preview/editing.
 * Uses archived raw_html when the stored TipTap doc is missing the block (legacy/plain paths).
 */
export function resolveNoteEditorContent(
  note: Pick<
    Note,
    "content" | "rawHtml" | "tags" | "recordType" | "emailPipelineVersion"
  >,
): string {
  const base = note.content ?? "";
  const parsed = tryParseTipTapDoc(base);
  const rawHtml = note.rawHtml?.trim();
  const inboundEmail = isInboundEmailNote(note);

  if (parsed && inboundEmail && rawHtml) {
    const existingBlock = findEmailHtmlBlock(parsed);
    if (existingBlock && !emailHtmlBlockNeedsRebuild(existingBlock, rawHtml)) {
      return base.trim().startsWith("{") ? base : JSON.stringify(parsed);
    }
  } else if (parsed && findEmailHtmlBlock(parsed)) {
    return base.trim().startsWith("{") ? base : JSON.stringify(parsed);
  }

  if (!inboundEmail || !rawHtml) {
    return base;
  }

  const prepared = prepareInboundEmailHtml(rawHtml);
  if (!prepared.html) {
    return base;
  }

  const preserved: unknown[] = parsed?.content
    ? parsed.content.filter((node) => {
        if (!node || typeof node !== "object") return false;
        return (node as { type?: string }).type !== "emailHtmlBlock";
      })
    : [];

  if (!parsed) {
    const trimmed = base.trim();
    if (trimmed) {
      preserved.unshift({
        type: "paragraph",
        content: [{ type: "text", text: trimmed }],
      });
    }
  }

  const doc: TipTapDoc = {
    type: "doc",
    content: [...preserved, { type: "paragraph" }, emailHtmlBlockNode(prepared.html, prepared.css, note.emailPipelineVersion)],
  };

  return JSON.stringify(doc);
}