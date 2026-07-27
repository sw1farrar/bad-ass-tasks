import {
  Calendar,
  Check,
  FolderOpen,
  HeartPulse,
  Home,
  ListChecks,
  MessageCircle,
  Notebook,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Workspace } from "@/types";
import { isHealthFeatureEnabled, isNotesFeatureEnabled } from "@/lib/workspace/workspaceSettings";

export type WorkspaceNavViewId =
  | "home"
  | "tasks"
  | "notes"
  | "notebooks"
  | "meetings"
  | "lists"
  | "chat"
  | "health"
  | "teams"
  | "settings"
  | "admin";

export type WorkspaceNavView = {
  id: WorkspaceNavViewId;
  label: string;
  icon: LucideIcon;
  /** Shorter label for compact nav chrome */
  shortLabel?: string;
};

export type WorkspaceNavOptions = {
  /** Multi-member workspaces only */
  showChat?: boolean;
  isSiteAdmin?: boolean;
};

const ALL_VIEWS: WorkspaceNavView[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "tasks", label: "Tasks", icon: Check },
  { id: "notes", label: "Files", icon: FolderOpen },
  { id: "notebooks", label: "Notes", icon: Notebook },
  { id: "meetings", label: "Meetings", icon: Calendar },
  { id: "lists", label: "Lists", icon: ListChecks },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "teams", label: "Team", icon: Users },
  {
    id: "settings",
    label: "Workspace Settings",
    shortLabel: "Settings",
    icon: Settings,
  },
];

function isViewVisible(
  id: WorkspaceNavViewId,
  workspace: Workspace,
  opts?: WorkspaceNavOptions,
): boolean {
  if (id === "chat") return opts?.showChat === true;
  if (id === "notebooks" || id === "meetings") return isNotesFeatureEnabled(workspace.settings);
  if (id === "health") return isHealthFeatureEnabled(workspace.settings);
  return true;
}

/** Bottom nav + URL routing — includes Home and Settings. */
export function getBottomNavViews(
  workspace: Workspace,
  opts?: WorkspaceNavOptions,
): WorkspaceNavView[] {
  return ALL_VIEWS.filter((v) => isViewVisible(v.id, workspace, opts));
}

/** Desktop sidebar workspace views (Home rendered separately). */
export function getSidebarWorkspaceViews(
  workspace: Workspace,
  opts?: WorkspaceNavOptions,
): WorkspaceNavView[] {
  return ALL_VIEWS.filter((v) => v.id !== "home" && isViewVisible(v.id, workspace, opts));
}

export function isValidNavView(
  view: string,
  workspace: Workspace,
  opts?: WorkspaceNavOptions,
): view is WorkspaceNavViewId {
  if (view === "admin") return opts?.isSiteAdmin === true;
  if (view === "calendar" || view === "today") return true;
  const allowed = new Set([
    ...getBottomNavViews(workspace, opts).map((v) => v.id),
    ...(opts?.isSiteAdmin ? (["admin"] as const) : []),
  ]);
  return allowed.has(view as WorkspaceNavViewId);
}

export function resolveNavView(view: string): WorkspaceNavViewId {
  if (view === "calendar" || view === "today") return "home";
  return view as WorkspaceNavViewId;
}