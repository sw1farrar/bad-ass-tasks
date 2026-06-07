import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { NotificationType } from "@/types";

/** Email notification scaffold (extends the invite email placeholder).
 * For production: integrate Resend / Supabase Edge Function / API route.
 */
export async function sendNotificationEmail(
  toEmail: string | null | undefined,
  type: NotificationType,
  data: { title: string; message: string; workspaceName?: string; link?: string; actor?: string },
): Promise<boolean> {
  if (!isSupabaseConfigured() || !toEmail) return false;

  console.info(
    `[NOTIF EMAIL SCAFFOLD] Would send ${type} email to ${toEmail}: "${data.title}" — ${data.message}. ` +
      `Workspace: ${data.workspaceName || "n/a"}. Link: ${data.link || "app"}. Actor: ${data.actor || "system"}. ` +
      `Future: wire Resend SDK or edge fn (see sendInviteEmail for example).`,
  );

  return true;
}