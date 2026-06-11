type BinaryLike = ArrayBuffer | Buffer | Uint8Array;

function binaryBytes(buffer: BinaryLike): Uint8Array {
  if (buffer instanceof Uint8Array) return buffer;
  if (Buffer.isBuffer(buffer)) return buffer;
  return new Uint8Array(buffer);
}

function leadingTextSample(buffer: BinaryLike, max = 4096): string {
  const view = binaryBytes(buffer);
  const slice = view.subarray(0, Math.min(view.length, max));
  return Buffer.from(slice).toString("utf8").replace(/^\uFEFF/, "").trimStart();
}

/** Rich Text Format — common for email attachments named .doc */
export function isRtfDocument(buffer: BinaryLike): boolean {
  const sample = leadingTextSample(buffer, 32).toLowerCase();
  return sample.startsWith("{\\rtf");
}

/** HTML saved with a Word extension (Word HTML export / Outlook). */
export function isHtmlWordDocument(buffer: BinaryLike): boolean {
  const sample = leadingTextSample(buffer, 512).toLowerCase();
  if (!sample.startsWith("<")) return false;
  return (
    sample.includes("<html") ||
    sample.includes("<!doctype") ||
    sample.includes("xmlns:o=\"urn:schemas-microsoft-com:office:office") ||
    sample.includes("schemas-microsoft-com:office:word")
  );
}

/** Word 2003 XML (.xml / some .doc exports). */
export function isWordXmlDocument(buffer: BinaryLike): boolean {
  const sample = leadingTextSample(buffer, 4096).toLowerCase();
  // HTML Word exports also reference office:word namespaces — do not treat them as XML.
  if (sample.startsWith("<!doctype html") || sample.includes("<html")) return false;
  if (!sample.startsWith("<?xml") && !sample.startsWith("<w:")) return false;
  return (
    sample.includes("wordprocessingml") ||
    sample.includes("<w:worddocument") ||
    sample.includes("schemas-microsoft-com:office:word")
  );
}

export function extractRtfPlainText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?\s?/gi, "\n")
    .replace(/\\line\s?/gi, "\n")
    .replace(/\\tab\s?/gi, "\t")
    .replace(/\\'[0-9a-f]{2}/gi, (match) =>
      String.fromCharCode(parseInt(match.slice(2), 16)),
    )
    .replace(/\\u(-?\d+)\??/g, (_, code: string) => {
      const value = parseInt(code, 10);
      if (Number.isNaN(value)) return "";
      const normalized = value < 0 ? 65536 + value : value;
      try {
        return String.fromCodePoint(normalized);
      } catch {
        return "";
      }
    })
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractHtmlPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|table|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) => {
      const value = parseInt(code, 10);
      return Number.isNaN(value) ? "" : String.fromCodePoint(value);
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractWordXmlPlainText(xml: string): string {
  return xml
    .split(/<\/w:p>/i)
    .map((chunk) => {
      const parts: string[] = [];
      const re = /<w:t[^>]*>([^<]*)<\/w:t>/gi;
      let match = re.exec(chunk);
      while (match) {
        if (match[1]) parts.push(match[1]);
        match = re.exec(chunk);
      }
      return parts.join("");
    })
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function extractAlternateWordText(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  const latin1 = buffer.toString("latin1");

  if (isRtfDocument(buffer)) {
    return extractRtfPlainText(latin1);
  }
  if (isHtmlWordDocument(buffer)) {
    return extractHtmlPlainText(utf8);
  }
  if (isWordXmlDocument(buffer)) {
    return extractWordXmlPlainText(utf8);
  }

  return "";
}