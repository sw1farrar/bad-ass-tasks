import { stripHtmlToPlainText } from "@/lib/brevo/inboundNoteContent";

type TipTapNode = {
  type?: string;
  text?: string;
  content?: TipTapNode[];
  attrs?: Record<string, unknown>;
};

/**
 * Plain text for note search — includes emailHtmlBlock body (unlike jsonToNoteContent preview).
 */
export function extractNoteSearchText(doc: unknown): string {
  const parts: string[] = [];

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const n = node as TipTapNode;

    if (typeof n.text === "string") {
      parts.push(n.text);
      return;
    }

    if (n.type === "emailHtmlBlock" && typeof n.attrs?.html === "string") {
      parts.push(stripHtmlToPlainText(n.attrs.html));
    }

    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
    }
  }

  walk(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}