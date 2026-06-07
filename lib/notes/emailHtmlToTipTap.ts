import type { Json } from "@/types/supabase";
import type { BrevoInboundEmailItem } from "@/lib/brevo/inboundTypes";
import {
  buildInboundNotePlainText,
  formatInboundSenderLine,
  plainTextToTipTapDoc,
} from "@/lib/brevo/inboundNoteContent";
import {
  prepareInboundEmailHtml,
  sanitizeInboundEmailHtml as sanitizeEmailHtml,
} from "@/lib/notes/sanitizeInboundEmailHtml";
import { EMAIL_PIPELINE_VERSION } from "@/lib/notes/emailPipeline";

export { sanitizeEmailHtml as sanitizeInboundEmailHtml };

type TipTapNode = {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
};

function metaParagraphs(item: BrevoInboundEmailItem): TipTapNode[] {
  const sender = formatInboundSenderLine(item);
  const sentAt = item.SentAtDate?.trim();
  const lines = [`From: ${sender}`];
  if (sentAt) lines.push(`Sent: ${sentAt}`);

  return lines.map((line) => ({
    type: "paragraph",
    content: [{ type: "text", text: line }],
  }));
}

function emailHtmlBlockNode(html: string, styles = "", pipelineVersion = EMAIL_PIPELINE_VERSION): TipTapNode {
  return {
    type: "emailHtmlBlock",
    attrs: { html, styles, pipelineVersion },
  };
}

/** Placeholder while attachments (CID images) are still uploading. */
export function buildInboundNotePlaceholderContent(item: BrevoInboundEmailItem): Json {
  return {
    type: "doc",
    content: [
      ...metaParagraphs(item),
      {
        type: "paragraph",
        content: [{ type: "text", text: "Processing email…" }],
      },
    ],
  } as Json;
}

function plainBodyDoc(item: BrevoInboundEmailItem): Json {
  return plainTextToTipTapDoc(buildInboundNotePlainText(item));
}

/**
 * Build TipTap JSON for an inbound email note.
 * Preserves the original HTML layout in an emailHtmlBlock for faithful rendering.
 */
export function buildInboundNoteContentJson(
  item: BrevoInboundEmailItem,
  imageUrlByCid?: Record<string, string>,
): Json {
  const rawHtml = item.RawHtmlBody?.trim();
  if (rawHtml) {
    const prepared = prepareInboundEmailHtml(rawHtml, imageUrlByCid);
    if (prepared.html) {
      return {
        type: "doc",
        content: [
          ...metaParagraphs(item),
          { type: "paragraph" },
          emailHtmlBlockNode(prepared.html, prepared.css),
        ],
      } as Json;
    }
  }

  return plainBodyDoc(item);
}

/** Never throws — falls back to plain text if the HTML pipeline fails. */
export function safeBuildInboundNoteContentJson(
  item: BrevoInboundEmailItem,
  imageUrlByCid?: Record<string, string>,
): Json {
  try {
    return buildInboundNoteContentJson(item, imageUrlByCid);
  } catch (err) {
    console.error("[email-pipeline] buildInboundNoteContentJson failed, using plain text", err);
    return plainBodyDoc(item);
  }
}

export function isInboundNotePlaceholderContent(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  const serialized = JSON.stringify(content);
  return serialized.includes("Processing email");
}

/** @deprecated Use buildInboundNoteContentJson — kept for tests. */
export function htmlToTipTapDoc(html: string): Json {
  const prepared = prepareInboundEmailHtml(html);
  if (!prepared.html) {
    return { type: "doc", content: [{ type: "paragraph" }] } as Json;
  }
  return {
    type: "doc",
    content: [emailHtmlBlockNode(prepared.html, prepared.css)],
  } as Json;
}

/** @deprecated CID replacement now happens in HTML string before block insert. */
export function replaceCidImagesInTipTapDoc(
  doc: Json,
  cidToUrl: Record<string, string>,
): Json {
  if (!doc || typeof doc !== "object") return doc;

  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return node;
    const n = node as TipTapNode;

    if (n.type === "emailHtmlBlock" && typeof n.attrs?.html === "string") {
      const prepared = prepareInboundEmailHtml(n.attrs.html, cidToUrl);
      return {
        ...n,
        attrs: {
          ...n.attrs,
          html: prepared.html,
          styles: prepared.css || n.attrs.styles || "",
        },
      };
    }

    if (n.type === "image" && typeof n.attrs?.src === "string") {
      const src = n.attrs.src;
      const cidMatch = src.match(/^cid:(.+)$/i);
      if (cidMatch) {
        const key = cidMatch[1].replace(/^<|>$/g, "").trim().toLowerCase();
        const replacement = cidToUrl[key] ?? cidToUrl[cidMatch[1]];
        if (replacement) {
          return { ...n, attrs: { ...n.attrs, src: replacement } };
        }
      }
    }

    if (Array.isArray(n.content)) {
      return { ...n, content: n.content.map(walk) };
    }

    return n;
  };

  return walk(doc) as Json;
}