import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/types/supabase";
import type { BrevoInboundEmailItem } from "./inboundTypes";
import { safeBuildInboundNoteContentJson } from "@/lib/notes/emailHtmlToTipTap";
import { buildSearchDocument } from "@/lib/files/buildSearchDocument";
import { extractNoteSearchText } from "@/lib/notes/extractNoteSearchText";
import { EMAIL_PIPELINE_VERSION } from "@/lib/notes/emailPipeline";

export async function updateNoteRow(
  supabase: SupabaseClient,
  noteId: string,
  payload: Record<string, unknown>,
): Promise<{ error: { code?: string; message?: string } | null }> {
  let { error } = await (supabase.from("notes") as any).update(payload).eq("id", noteId);

  if (error?.code === "42703") {
    const minimal: Record<string, unknown> = {};
    if ("content" in payload) minimal.content = payload.content;
    if ("updated_at" in payload) minimal.updated_at = payload.updated_at;
    ({ error } = await (supabase.from("notes") as any).update(minimal).eq("id", noteId));
  }

  return { error };
}

export async function finalizeInboundNoteContent(params: {
  supabase: SupabaseClient;
  noteId: string;
  item: BrevoInboundEmailItem;
  title: string;
  rawHtml: string;
  cidToUrl: Record<string, string>;
  emailSource?: string | null;
}): Promise<boolean> {
  const finalContent = safeBuildInboundNoteContentJson(params.item, params.cidToUrl);
  const searchPlain = [params.title, extractNoteSearchText(finalContent)].filter(Boolean).join(" ").trim();
  const searchDocument = buildSearchDocument({
    title: params.title,
    searchPlain,
    tags: ["from-email"],
  });

  const updatePayload: Record<string, unknown> = {
    content: finalContent,
    updated_at: new Date().toISOString(),
    raw_html: params.rawHtml || null,
    email_source: params.emailSource ?? null,
    search_plain: searchPlain || null,
    search_document: searchDocument || null,
    email_pipeline_version: EMAIL_PIPELINE_VERSION,
    review_status: "pending_review",
    record_type: "email",
  };

  const { error } = await updateNoteRow(params.supabase, params.noteId, updatePayload);
  if (error) {
    console.error("[brevo-inbound] note content finalize failed", error);
    return false;
  }
  return true;
}