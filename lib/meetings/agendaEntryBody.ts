import { isEmptyNoteContent } from "@/lib/notes/noteUpdates";
import { formatClipboardHtmlText } from "@/lib/meetings/agendaEntryLabels";

export const EMPTY_AGENDA_DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

type TipTapMark = {
  type?: string;
  attrs?: Record<string, unknown>;
};

type TipTapNode = {
  type?: string;
  text?: string;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  attrs?: Record<string, unknown>;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function looksLikeTipTapDoc(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.startsWith("{") && trimmed.includes('"type"') && trimmed.includes('"doc"');
}

function parseTipTapDoc(body: string): TipTapNode | null {
  const trimmed = body.trim();
  if (!looksLikeTipTapDoc(trimmed)) return null;
  try {
    const parsed = JSON.parse(trimmed) as TipTapNode;
    if (parsed && typeof parsed === "object" && parsed.type === "doc") return parsed;
  } catch {
    // ignore
  }
  return null;
}

function inlinePlainText(node: TipTapNode): string {
  if (typeof node.text === "string") return node.text;
  if (node.type === "hardBreak") return "\n";
  if (node.type === "image") {
    return typeof node.attrs?.alt === "string" && node.attrs.alt
      ? `[Image: ${node.attrs.alt}]`
      : "[Image]";
  }
  if (!Array.isArray(node.content)) return "";
  return node.content.map(inlinePlainText).join("");
}

function blockPlainText(node: TipTapNode): string {
  switch (node.type) {
    case "paragraph":
    case "heading":
    case "blockquote":
    case "codeBlock":
      return inlinePlainText(node);
    case "bulletList":
    case "orderedList":
      return (node.content ?? [])
        .map((item) => {
          const itemText = (item.content ?? []).map(blockPlainText).join("\n");
          return itemText
            .split("\n")
            .map((line, index) => (index === 0 ? `- ${line}` : `  ${line}`))
            .join("\n");
        })
        .join("\n");
    case "listItem":
      return (node.content ?? []).map(blockPlainText).join("\n");
    case "table":
      return (node.content ?? [])
        .map((row) =>
          (row.content ?? [])
            .map((cell) => (cell.content ?? []).map(blockPlainText).join(" ").trim())
            .join(" | "),
        )
        .join("\n");
    case "horizontalRule":
      return "---";
    case "image":
      return typeof node.attrs?.alt === "string" && node.attrs.alt
        ? `[Image: ${node.attrs.alt}]`
        : "[Image]";
    default:
      if (Array.isArray(node.content)) {
        return node.content.map(blockPlainText).join("\n");
      }
      return inlinePlainText(node);
  }
}

/** Plain text from TipTap JSON or legacy plain bodies (newlines preserved). */
export function agendaEntryPlainText(body: string): string {
  const doc = parseTipTapDoc(body);
  if (!doc) return body.replace(/\r\n/g, "\n");
  const blocks = (doc.content ?? []).map(blockPlainText);
  return blocks.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function nodeHasMedia(node: TipTapNode): boolean {
  if (node.type === "image" && typeof node.attrs?.src === "string" && node.attrs.src) {
    return true;
  }
  return (node.content ?? []).some(nodeHasMedia);
}

/** True when body has no meaningful text and no media (whitespace-only TipTap counts as empty). */
export function isEmptyAgendaEntryBody(body: string | undefined | null): boolean {
  if (isEmptyNoteContent(body)) return true;
  const doc = parseTipTapDoc(body ?? "");
  if (!doc) return !(body ?? "").trim();
  if (agendaEntryPlainText(body ?? "").trim()) return false;
  return !nodeHasMedia(doc);
}

export function agendaEntryHasDecisionTag(body: string): boolean {
  return /#decision/i.test(agendaEntryPlainText(body));
}

export function stripAgendaDecisionTag(body: string): string {
  return agendaEntryPlainText(body).replace(/#decision/gi, "").replace(/\s+/g, " ").trim();
}

/** Allow only http(s), mailto, and data:image URLs in exported HTML. */
function sanitizeUrl(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(href)) return href;
  return null;
}

function renderMarks(textHtml: string, marks: TipTapMark[] | undefined): string {
  let html = textHtml;
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "code":
        html = `<code>${html}</code>`;
        break;
      case "link": {
        const href = typeof mark.attrs?.href === "string" ? sanitizeUrl(mark.attrs.href) : null;
        if (href) {
          html = `<a href="${escapeHtml(href)}">${html}</a>`;
        }
        break;
      }
      default:
        break;
    }
  }
  return html;
}

function renderInlineHtml(node: TipTapNode): string {
  if (typeof node.text === "string") {
    return renderMarks(escapeHtml(node.text), node.marks);
  }
  if (node.type === "hardBreak") return "<br />";
  if (node.type === "image") {
    const src =
      typeof node.attrs?.src === "string" ? sanitizeUrl(node.attrs.src) : null;
    if (!src) return "";
    const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
  }
  return (node.content ?? []).map(renderInlineHtml).join("");
}

function renderBlockHtml(node: TipTapNode): string {
  const inner = (node.content ?? []).map(renderInlineHtml).join("");
  switch (node.type) {
    case "paragraph":
      return `<p>${inner || "<br />"}</p>`;
    case "heading": {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
      return `<h${level}>${inner}</h${level}>`;
    }
    case "blockquote":
      return `<blockquote>${(node.content ?? []).map(renderBlockHtml).join("")}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${escapeHtml(inlinePlainText(node))}</code></pre>`;
    case "bulletList":
      return `<ul>${(node.content ?? []).map(renderBlockHtml).join("")}</ul>`;
    case "orderedList":
      return `<ol>${(node.content ?? []).map(renderBlockHtml).join("")}</ol>`;
    case "listItem":
      return `<li>${(node.content ?? []).map(renderBlockHtml).join("")}</li>`;
    case "horizontalRule":
      return "<hr />";
    case "table":
      return `<table>${(node.content ?? []).map(renderBlockHtml).join("")}</table>`;
    case "tableRow":
      return `<tr>${(node.content ?? []).map(renderBlockHtml).join("")}</tr>`;
    case "tableHeader":
      return `<th>${(node.content ?? []).map(renderBlockHtml).join("")}</th>`;
    case "tableCell":
      return `<td>${(node.content ?? []).map(renderBlockHtml).join("")}</td>`;
    case "image":
      return renderInlineHtml(node);
    default:
      if (Array.isArray(node.content)) {
        return node.content.map(renderBlockHtml).join("");
      }
      return inner ? `<p>${inner}</p>` : "";
  }
}

/**
 * Safe HTML for UI / document export.
 * TipTap JSON → structured HTML; plain text → escaped with line breaks.
 */
export function agendaEntryBodyToHtml(
  body: string,
  escapePlain: (text: string) => string = escapeHtml,
): string {
  const doc = parseTipTapDoc(body);
  if (!doc) {
    return `<p>${formatClipboardHtmlText(body, escapePlain)}</p>`;
  }
  const html = (doc.content ?? []).map(renderBlockHtml).join("");
  return html || "<p></p>";
}

/** Clipboard-friendly HTML (inline styles optional via caller wrappers). */
export function agendaEntryBodyToClipboardHtml(
  body: string,
  escapePlain: (text: string) => string,
): string {
  const doc = parseTipTapDoc(body);
  if (!doc) return formatClipboardHtmlText(body, escapePlain);
  return agendaEntryBodyToHtml(body, escapePlain);
}
