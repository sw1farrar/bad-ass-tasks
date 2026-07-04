import type { ArchiveTitleContext } from "@/lib/files/archiveTitleRules";
import {
  noteBodyPlain,
  preprocessArchiveTitleSignals,
} from "@/lib/files/preprocessArchiveTitleContext";

const MAX_SECTION_CHARS = 10_000;
const MAX_TOTAL_CHARS = 28_000;

function truncate(text: string, max = MAX_SECTION_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}\n…[content truncated]`;
}

/** Assemble readable content for the model — attachments first, subject last (low trust). */
export function buildArchiveTitleUserPrompt(ctx: ArchiveTitleContext): string {
  const signals = preprocessArchiveTitleSignals(ctx);
  const sections: string[] = [
    "Analyze the sources below. Fill analysis first, then output (subject, date YYYY-MM-DD, institution).",
    "Read attachments before the email subject — the subject line is LOW TRUST marketing copy.",
    "",
  ];

  if (ctx.attachmentTexts?.length) {
    ctx.attachmentTexts.forEach((text, index) => {
      const name = ctx.attachmentFileNames?.[index] ?? `attachment ${index + 1}`;
      sections.push(
        `=== ATTACHMENT: ${name} (extracted text — HIGHEST PRIORITY) ===`,
        truncate(text),
        "",
      );
    });
  } else if (ctx.attachmentFileNames?.length) {
    sections.push(
      "=== ATTACHMENTS (names only — no extracted text available) ===",
      ctx.attachmentFileNames.join("\n"),
      "",
    );
  }

  const signalLines: string[] = [];
  if (signals.dollarLines.length) {
    signalLines.push("Priced line items (fees/totals excluded):");
    signalLines.push(...signals.dollarLines.map((l) => `- ${l}`));
  }
  if (signals.merchantCandidates.length) {
    signalLines.push("", "Merchant candidates (seller, not payment method):");
    signalLines.push(...signals.merchantCandidates.map((m) => `- ${m}`));
  }
  if (signals.rejectedBoilerplate.length) {
    signalLines.push("", "Rejected boilerplate:");
    signalLines.push(...signals.rejectedBoilerplate.map((b) => `- ${b}`));
  }
  if (signals.emailReceiptLineItems.length) {
    sections.push(
      "=== EMAIL RECEIPT LINE ITEMS (parsed from email body HTML) ===",
      signals.emailReceiptLinesText,
      "",
    );
  }

  if (signalLines.length) {
    sections.push("=== EXTRACTED SIGNALS (hints — verify in sources) ===", signalLines.join("\n"), "");
  }

  const body = noteBodyPlain(ctx);
  if (body) {
    sections.push("=== EMAIL / NOTE BODY ===", truncate(body), "");
  }

  if (ctx.title?.trim()) {
    sections.push(
      "=== EMAIL / NOTE SUBJECT (LOW TRUST — marketing boilerplate) ===",
      truncate(ctx.title.trim()),
      "",
    );
  }

  if (ctx.recordType) {
    sections.push(`=== RECORD TYPE HINT (may be wrong) ===`, ctx.recordType, "");
  }

  if (ctx.createdAt) {
    sections.push(`=== UPLOADED TO SYSTEM (fallback date only) ===`, ctx.createdAt, "");
  }

  let prompt = sections.join("\n");
  if (prompt.length > MAX_TOTAL_CHARS) {
    prompt = `${prompt.slice(0, MAX_TOTAL_CHARS)}\n…[overall context truncated]`;
  }

  return prompt;
}