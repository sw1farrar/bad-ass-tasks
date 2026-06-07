import sanitizeHtml from "sanitize-html";
import type { Json } from "@/types/supabase";
import type { BrevoInboundEmailItem } from "@/lib/brevo/inboundTypes";
import {
  buildInboundNotePlainText,
  formatInboundSenderLine,
  plainTextToTipTapDoc,
} from "@/lib/brevo/inboundNoteContent";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "div",
    "span",
    "h1",
    "h2",
    "h3",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "blockquote",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    "*": ["style"],
  },
  allowedSchemes: ["http", "https", "mailto", "data", "cid"],
  transformTags: {
    b: "strong",
    i: "em",
  },
};

type TipTapNode = { type: string; content?: TipTapNode[]; text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }>; attrs?: Record<string, unknown> };

function textNode(text: string, marks?: TipTapNode["marks"]): TipTapNode {
  const node: TipTapNode = { type: "text", text };
  if (marks?.length) node.marks = marks;
  return node;
}

function paragraph(content: TipTapNode[]): TipTapNode {
  return { type: "paragraph", content: content.length ? content : undefined };
}

function heading(level: 1 | 2 | 3, content: TipTapNode[]): TipTapNode {
  return { type: "heading", attrs: { level }, content };
}

function parseInlineHtml(html: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  const tokenRegex = /(<a\b[^>]*>[\s\S]*?<\/a>|<strong\b[^>]*>[\s\S]*?<\/strong>|<b\b[^>]*>[\s\S]*?<\/b>|<em\b[^>]*>[\s\S]*?<\/em>|<i\b[^>]*>[\s\S]*?<\/i>|<img\b[^>]*\/?>)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (raw: string) => {
    const text = raw.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    if (text) nodes.push(textNode(text));
  };

  while ((match = tokenRegex.exec(html)) !== null) {
    pushText(html.slice(lastIndex, match.index));
    const token = match[0];

    if (/^<img/i.test(token)) {
      const srcMatch = token.match(/\bsrc=["']([^"']+)["']/i);
      const altMatch = token.match(/\balt=["']([^"']*)["']/i);
      if (srcMatch?.[1]) {
        nodes.push({
          type: "image",
          attrs: { src: srcMatch[1], alt: altMatch?.[1] ?? "Image" },
        });
      }
    } else if (/^<a/i.test(token)) {
      const hrefMatch = token.match(/\bhref=["']([^"']+)["']/i);
      const inner = token.replace(/^<a\b[^>]*>/i, "").replace(/<\/a>$/i, "");
      const innerNodes = parseInlineHtml(inner);
      if (hrefMatch?.[1] && innerNodes.length) {
        innerNodes.forEach((n) => {
          if (n.type === "text") {
            n.marks = [...(n.marks ?? []), { type: "link", attrs: { href: hrefMatch[1], target: "_blank" } }];
          }
        });
        nodes.push(...innerNodes);
      } else {
        pushText(inner);
      }
    } else {
      const inner = token.replace(/^<[^>]+>/i, "").replace(/<\/[^>]+>$/i, "");
      const markType = /^<(?:strong|b)/i.test(token) ? "bold" : "italic";
      const innerNodes = parseInlineHtml(inner);
      innerNodes.forEach((n) => {
        if (n.type === "text") {
          n.marks = [...(n.marks ?? []), { type: markType }];
        }
      });
      nodes.push(...innerNodes);
    }

    lastIndex = match.index + token.length;
  }

  pushText(html.slice(lastIndex));
  return nodes;
}

function blockFromElement(tag: string, innerHtml: string): TipTapNode | TipTapNode[] | null {
  const trimmed = innerHtml.trim();
  if (!trimmed) return null;

  if (tag === "ul" || tag === "ol") {
    const items = [...trimmed.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => ({
      type: "listItem",
      content: [paragraph(parseInlineHtml(m[1]))],
    }));
    if (!items.length) return null;
    return { type: tag === "ol" ? "orderedList" : "bulletList", content: items };
  }

  if (tag === "blockquote") {
    return { type: "blockquote", content: [paragraph(parseInlineHtml(trimmed))] };
  }

  if (tag === "h1" || tag === "h2" || tag === "h3") {
    const level = Number(tag[1]) as 1 | 2 | 3;
    return heading(level, parseInlineHtml(trimmed));
  }

  if (tag === "img" || /^<img/i.test(trimmed)) {
    const srcMatch = trimmed.match(/\bsrc=["']([^"']+)["']/i);
    const altMatch = trimmed.match(/\balt=["']([^"']*)["']/i);
    if (srcMatch?.[1]) {
      return { type: "image", attrs: { src: srcMatch[1], alt: altMatch?.[1] ?? "Image" } };
    }
    return null;
  }

  return paragraph(parseInlineHtml(trimmed));
}

function htmlToTipTapNodes(sanitizedHtml: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  const blockRegex = /<(p|div|h1|h2|h3|ul|ol|blockquote|table)\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*\/?>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(sanitizedHtml)) !== null) {
    const between = sanitizedHtml.slice(lastIndex, match.index).trim();
    if (between) {
      const inline = blockFromElement("p", between);
      if (inline) nodes.push(inline as TipTapNode);
    }

    if (match[0].startsWith("<img")) {
      const img = blockFromElement("img", match[0]);
      if (img) nodes.push(img as TipTapNode);
    } else {
      const tag = match[1].toLowerCase();
      const inner = match[2];
      const block = blockFromElement(tag, inner);
      if (Array.isArray(block)) nodes.push(...block);
      else if (block) nodes.push(block);
    }

    lastIndex = match.index + match[0].length;
  }

  const tail = sanitizedHtml.slice(lastIndex).trim();
  if (tail) {
    const block = blockFromElement("p", tail);
    if (block) nodes.push(block as TipTapNode);
  }

  if (!nodes.length) {
    const fallback = blockFromElement("p", sanitizedHtml);
    if (fallback) nodes.push(fallback as TipTapNode);
  }

  return nodes;
}

export function sanitizeInboundEmailHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS).trim();
}

export function htmlToTipTapDoc(html: string): Json {
  const sanitized = sanitizeInboundEmailHtml(html);
  if (!sanitized) {
    return { type: "doc", content: [{ type: "paragraph" }] } as Json;
  }

  const content = htmlToTipTapNodes(sanitized);
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  } as Json;
}

export function replaceCidImagesInTipTapDoc(
  doc: Json,
  cidToUrl: Record<string, string>,
): Json {
  if (!doc || typeof doc !== "object") return doc;

  const walk = (node: any): any => {
    if (!node || typeof node !== "object") return node;

    if (node.type === "image" && typeof node.attrs?.src === "string") {
      const src: string = node.attrs.src;
      const cidMatch = src.match(/^cid:(.+)$/i);
      if (cidMatch) {
        const key = cidMatch[1].toLowerCase();
        const replacement = cidToUrl[key] ?? cidToUrl[cidMatch[1]];
        if (replacement) {
          return { ...node, attrs: { ...node.attrs, src: replacement } };
        }
      }
    }

    if (Array.isArray(node.content)) {
      return { ...node, content: node.content.map(walk) };
    }

    return node;
  };

  return walk(doc);
}

function extractTextFromTipTapDoc(doc: unknown): string {
  let text = "";
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { text?: string; content?: unknown };
    if (typeof n.text === "string") text += `${n.text} `;
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return text.trim();
}

function prependEmailMeta(doc: Json, item: BrevoInboundEmailItem): Json {
  const sender = formatInboundSenderLine(item);
  const sentAt = item.SentAtDate?.trim();
  const metaLines = [`From: ${sender}`];
  if (sentAt) metaLines.push(`Sent: ${sentAt}`);

  const metaDoc = plainTextToTipTapDoc(metaLines.join("\n"));
  const metaContent = (metaDoc as { content?: Json[] }).content ?? [];
  const bodyContent = (doc as { content?: Json[] }).content ?? [];

  return {
    type: "doc",
    content: [...metaContent, { type: "paragraph" }, ...bodyContent],
  } as Json;
}

export function buildInboundNoteContentJson(
  item: BrevoInboundEmailItem,
  imageUrlByCid?: Record<string, string>,
): Json {
  const plainDoc = plainTextToTipTapDoc(buildInboundNotePlainText(item));
  const html = item.RawHtmlBody?.trim();

  if (!html) {
    return plainDoc;
  }

  let doc = htmlToTipTapDoc(html);
  if (imageUrlByCid && Object.keys(imageUrlByCid).length) {
    doc = replaceCidImagesInTipTapDoc(doc, imageUrlByCid);
  }

  const htmlText = extractTextFromTipTapDoc(doc);
  if (!htmlText) {
    return plainDoc;
  }

  return prependEmailMeta(doc, item);
}