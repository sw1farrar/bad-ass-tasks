import { callXaiChat, isXaiConfigured } from "@/lib/ai/xaiClient";
import { ARCHIVE_TITLE_SYSTEM_PROMPT } from "@/lib/files/archiveTitlePrompt";
import { buildArchiveTitleUserPrompt } from "@/lib/files/buildArchiveTitlePrompt";
import {
  normalizeArchiveDate,
  sanitizeArchiveInstitution,
  sanitizeArchiveSubject,
  type ArchiveTitleParts,
} from "@/lib/files/archiveTitle";
import {
  sanitizeAiInstitution,
  sanitizeAiSubject,
  type ArchiveTitleContext,
} from "@/lib/files/archiveTitleRules";
import { guaranteeArchiveTitle } from "@/lib/files/guaranteeArchiveTitle";
import { resolveArchiveDocumentKind } from "@/lib/files/finalizeArchiveTitle";
import { sanitizeArchiveTitleContext } from "@/lib/files/sanitizeArchiveTitleContext";
import { combinedArchiveNamingText } from "@/lib/files/preprocessArchiveTitleContext";
import { suggestArchiveTitleHeuristic } from "@/lib/files/suggestArchiveTitleHeuristic";
import {
  buildArchiveTitleRetryPrompt,
  validateArchiveTitleParts,
} from "@/lib/files/validateArchiveTitle";

export type SuggestArchiveTitleResult = {
  title: string;
  parts: ArchiveTitleParts;
  source: "ai" | "heuristic";
};

type AiResponseShape = {
  analysis?: { document_kind?: string };
  output?: Partial<ArchiveTitleParts>;
  subject?: string;
  date?: string;
  institution?: string;
};

function heuristicResult(ctx: ArchiveTitleContext): SuggestArchiveTitleResult {
  const heuristic = suggestArchiveTitleHeuristic(ctx);
  const guaranteed = guaranteeArchiveTitle(heuristic.parts, ctx);
  return { ...guaranteed, source: "heuristic" };
}

function normalizeAiParts(
  raw: AiResponseShape,
  fallback: ArchiveTitleParts,
  ctx: ArchiveTitleContext,
): ArchiveTitleParts | null {
  const output = raw.output ?? raw;
  const subjectRaw = String(output.subject ?? "").trim();
  const dateRaw = String(output.date ?? (raw as { date_iso?: string }).date_iso ?? "").trim();
  const institutionRaw = String(output.institution ?? "").trim();

  const date = normalizeArchiveDate(dateRaw) ?? fallback.date;
  const kind = resolveArchiveDocumentKind(ctx);
  const text = combinedArchiveNamingText(ctx);
  const subject = sanitizeAiSubject(
    sanitizeArchiveSubject(subjectRaw),
    kind,
    text,
    ctx,
  );
  const institution = sanitizeAiInstitution(
    sanitizeArchiveInstitution(institutionRaw),
    kind,
    text,
    ctx,
  );

  if (!subject || !date) return null;
  return { subject, date, institution };
}

function parseAiResponse(
  raw: string,
  fallback: ArchiveTitleParts,
  ctx: ArchiveTitleContext,
): ArchiveTitleParts | null {
  try {
    const parsed = JSON.parse(raw) as AiResponseShape;
    return normalizeAiParts(parsed, fallback, ctx);
  } catch {
    return null;
  }
}

export async function suggestArchiveTitle(
  rawCtx: ArchiveTitleContext,
): Promise<SuggestArchiveTitleResult> {
  const ctx = sanitizeArchiveTitleContext(rawCtx);
  const heuristic = suggestArchiveTitleHeuristic(ctx);

  if (!isXaiConfigured()) {
    return heuristicResult(ctx);
  }

  const userPrompt = buildArchiveTitleUserPrompt(ctx);
  const kind = resolveArchiveDocumentKind(ctx);

  const aiResult = await callXaiChat({
    systemPrompt: ARCHIVE_TITLE_SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
    temperature: 0.15,
    maxTokens: 1100,
  });

  if (!aiResult.ok) {
    return heuristicResult(ctx);
  }

  const aiRaw = aiResult.content;

  let parts = parseAiResponse(aiRaw, heuristic.parts, ctx);
  if (!parts) {
    return heuristicResult(ctx);
  }

  let issues = validateArchiveTitleParts(parts, ctx, kind);
  if (issues.length) {
    const retryPrompt = `${userPrompt}\n\n${buildArchiveTitleRetryPrompt(issues, parts)}`;
    const retryResult = await callXaiChat({
      systemPrompt: ARCHIVE_TITLE_SYSTEM_PROMPT,
      userPrompt: retryPrompt,
      expectJson: true,
      temperature: 0.1,
      maxTokens: 1100,
    });

    if (retryResult.ok) {
      const retried = parseAiResponse(retryResult.content, heuristic.parts, ctx);
      if (retried) {
        parts = retried;
        issues = validateArchiveTitleParts(parts, ctx, kind);
      }
    }
  }

  const guaranteed = guaranteeArchiveTitle(parts, ctx);

  return {
    title: guaranteed.title,
    parts: guaranteed.parts,
    source: issues.length > 0 ? "heuristic" : "ai",
  };
}

export type { ArchiveTitleContext };