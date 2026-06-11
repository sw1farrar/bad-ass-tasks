import "server-only";

import WordExtractor from "word-extractor";
import { extractAlternateWordText } from "@/lib/preview/alternateWordFormats";
import type { LegacyWordDocPreview } from "@/lib/preview/legacyWordDocShared";

export type { LegacyWordDocPreview };

const WORD_EXTRACTOR_UNSUPPORTED = "Unable to read this type of file";

/** Extract readable text from Word-family files (.doc, .docx, RTF, Word HTML). */
export async function extractLegacyWordDoc(buffer: Buffer): Promise<LegacyWordDocPreview> {
  try {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    return {
      body: doc.getBody() ?? "",
      footnotes: doc.getFootnotes() ?? "",
      endnotes: doc.getEndnotes() ?? "",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message !== WORD_EXTRACTOR_UNSUPPORTED) throw err;

    const body = extractAlternateWordText(buffer).trim();
    if (!body) throw new Error(WORD_EXTRACTOR_UNSUPPORTED);

    return {
      body,
      footnotes: "",
      endnotes: "",
    };
  }
}