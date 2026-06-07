import { getBrevoConfig } from "@/lib/brevo/config";
import { sendBrevoTransactionalEmail } from "@/lib/brevo/sendBrevoTransactional";
import { escapeHtml } from "@/lib/brevo/emailUtils";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { NotificationType } from "@/types";

const TYPE_LABELS: Record<NotificationType, string> = {
  mention: "You were mentioned",
  comment: "New comment",
  invite: "Workspace invite",
  task_assigned: "Task assigned",
  deadline: "Due date reminder",
  activity: "Workspace activity",
};

const TYPE_TAGS: Record<NotificationType, string> = {
  mention: "notification-mention",
  comment: "notification-comment",
  invite: "notification-invite",
  task_assigned: "notification-assignment",
  deadline: "notification-deadline",
  activity: "notification-activity",
};

function buildAppLink(link?: string): string {
  const base = getBrevoConfig().appBaseUrl.replace(/\/$/, "");
  if (!link) return base;
  if (link.startsWith("http://") || link.startsWith("https://")) return link;
  const path = link.startsWith("/") ? link : `/${link}`;
  return `${base}${path}`;
}

export async function sendNotificationEmail(
  toEmail: string | null | undefined,
  type: NotificationType,
  data: { title: string; message: string; workspaceName?: string; link?: string; actor?: string },
): Promise<boolean> {
  if (!isSupabaseConfigured() || !toEmail) return false;

  const appLink = buildAppLink(data.link);
  const workspaceLine = data.workspaceName
    ? `<strong style="color:#18181b;">${escapeHtml(data.workspaceName)}</strong>`
    : "your workspace";
  const actorLine = data.actor ? ` from <strong style="color:#18181b;">${escapeHtml(data.actor)}</strong>` : "";

  const result = await sendBrevoTransactionalEmail({
    to: toEmail,
    tags: [TYPE_TAGS[type], "badazz-tasks", "notification"],
    content: {
      subject: `${data.title} — Badazz Tasks`,
      preheader: data.message,
      sections: [
        {
          heading: TYPE_LABELS[type],
          lead: data.message,
          bodyHtml: `<p style="margin:0;">${workspaceLine}${actorLine}</p>`,
          cta: { label: "Open in Badazz Tasks", href: appLink },
          footnote: "You received this because notifications are enabled for your account. Manage preferences in Settings.",
        },
      ],
    },
  });

  if (!result.ok) {
    console.warn("[sendNotificationEmail] delivery failed", type, result.reason);
    return false;
  }

  return true;
}