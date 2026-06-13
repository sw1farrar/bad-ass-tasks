import { stripHtmlToPlainText } from "@/lib/brevo/inboundNoteContent";
import { stripInvisibleUnicode } from "@/lib/files/archiveTitle";
import { extractNoteSearchText } from "@/lib/notes/extractNoteSearchText";
import {
  extractMerchantInstitution,
  PAYMENT_METHOD_INSTITUTIONS,
  type ArchiveTitleContext,
} from "@/lib/files/archiveTitleRules";

export type ArchiveTitleSignals = {
  dollarLines: string[];
  merchantCandidates: string[];
  rejectedBoilerplate: string[];
};

const BOILERPLATE_SUBJECT_RE =
  /^(?:(?:re|fw|fwd):\s*)?(?:your\s+)?(?:receipt|order(?:\s+confirmation)?|purchase(?:\s+confirmation)?)\b/i;

const FEE_LINE_RE =
  /\b(subtotal|sales tax|tax|shipping|delivery|handling|tip|gratuity|fee|total|amount due|balance due|order total)\b/i;

function noteBodyPlain(ctx: ArchiveTitleContext): string {
  const parts: string[] = [];

  if (ctx.emailHtml?.trim()) {
    const fromHtml = stripHtmlToPlainText(ctx.emailHtml);
    if (fromHtml) parts.push(fromHtml);
  }

  if (ctx.noteContent?.trim()) {
    try {
      const parsed = JSON.parse(ctx.noteContent);
      const extracted = extractNoteSearchText(parsed);
      if (extracted) parts.push(extracted);
    } catch {
      const raw = ctx.noteContent.trim();
      if (raw && !raw.startsWith("{")) parts.push(raw);
    }
  }

  if (ctx.searchPlain?.trim()) {
    let plain = ctx.searchPlain.trim();
    const title = ctx.title?.trim();
    if (title && plain.toLowerCase().startsWith(title.toLowerCase())) {
      plain = plain.slice(title.length).trim();
    }
    if (plain && !parts.some((p) => p.includes(plain.slice(0, 80)))) {
      parts.push(plain);
    }
  }

  if (ctx.memo?.trim()) parts.push(ctx.memo.trim());

  return parts.join("\n\n");
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function extractDollarLines(text: string): string[] {
  const lines: string[] = [];
  const splitLines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);

  for (const rawLine of splitLines) {
    const line = rawLine.trim();
    if (!line || !/(?:\$|USD\s*)?\s*[\d,]+\.\d{2}\b/i.test(line)) continue;
    if (FEE_LINE_RE.test(line)) continue;
    lines.push(line.slice(0, 140));
  }

  for (let i = 0; i < splitLines.length - 1; i++) {
    const line = splitLines[i];
    const next = splitLines[i + 1];
    if (!line || FEE_LINE_RE.test(line)) continue;
    if (/^(?:\$|USD\s*)?[\d,]+\.\d{2}$/i.test(next) && /[A-Za-z]{3,}/.test(line)) {
      lines.push(`${line} $${next.replace(/^\$/, "")}`);
    }
  }

  const inline = text.matchAll(
    /\b([A-Za-z0-9][A-Za-z0-9\s\-\/.'"]{3,70})\s*(?:\$|USD\s*)([\d,]+\.\d{2})\b/gi,
  );
  for (const match of inline) {
    const desc = match[1]?.trim();
    const amount = match[2];
    if (!desc || FEE_LINE_RE.test(desc)) continue;
    lines.push(`${desc} $${amount}`);
  }

  return dedupeLines(lines)
    .sort((a, b) => {
      const amount = (s: string) => {
        const m = s.match(/\$\s*([\d,]+\.?\d{0,2})/);
        return m ? Number(m[1].replace(/,/g, "")) : 0;
      };
      return amount(b) - amount(a);
    })
    .slice(0, 12);
}

function collectMerchantCandidates(ctx: ArchiveTitleContext, texts: string[]): string[] {
  const candidates = new Set<string>();

  const push = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) return;
    if (PAYMENT_METHOD_INSTITUTIONS.has(trimmed.toLowerCase())) return;
    candidates.add(trimmed);
  };

  for (const text of texts) {
    push(extractMerchantInstitution(text, ctx));
  }

  const title = ctx.title?.trim() ?? "";
  const titleMerchant = title.match(
    /^(?:re|fw|fwd):\s*(?:your\s+)?([A-Za-z0-9][A-Za-z0-9\s&'.-]{2,40}?)\s+(?:order|receipt|purchase|shipment)/i,
  );
  if (titleMerchant?.[1]) push(titleMerchant[1]);

  return [...candidates].filter(Boolean).slice(0, 6);
}

function collectRejectedBoilerplate(ctx: ArchiveTitleContext): string[] {
  const rejected: string[] = [];
  const title = ctx.title?.trim() ?? "";
  if (!title) return rejected;

  if (BOILERPLATE_SUBJECT_RE.test(title)) {
    rejected.push(
      `Email subject "${title}" is marketing boilerplate — do NOT use as subject or institution.`,
    );
  }

  if (/^your\s+/i.test(title)) {
    const firstWord = title.split(/\s+/)[0];
    if (firstWord) {
      rejected.push(
        `First word "${firstWord}" from subject is a pronoun, not a merchant — ignore for institution.`,
      );
    }
  }

  return rejected;
}

/** Pre-extract signals to assist the model (does not replace AI reasoning). */
export function preprocessArchiveTitleSignals(ctx: ArchiveTitleContext): ArchiveTitleSignals {
  const attachmentText = (ctx.attachmentTexts ?? []).join("\n\n");
  const bodyText = noteBodyPlain(ctx);
  const texts = [attachmentText, bodyText].filter(Boolean);

  const dollarLines = extractDollarLines(texts.join("\n\n"));
  const merchantCandidates = collectMerchantCandidates(ctx, texts);
  const rejectedBoilerplate = collectRejectedBoilerplate(ctx);

  return { dollarLines, merchantCandidates, rejectedBoilerplate };
}

/** Rich text for classification, validation, and sanitization (attachments + body, not search_document). */
export function combinedArchiveNamingText(ctx: ArchiveTitleContext): string {
  const attachmentText = (ctx.attachmentTexts ?? []).join("\n");
  const bodyText = noteBodyPlain(ctx);
  return stripInvisibleUnicode(
    [attachmentText, bodyText, ctx.title, ctx.memo].filter(Boolean).join("\n"),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export { noteBodyPlain };