import {
  Calendar,
  Check,
  FolderOpen,
  HeartPulse,
  Home,
  ListChecks,
  MapPinned,
  MessageCircle,
  Notebook,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Workspace } from "@/types";
import {
  isHealthFeatureEnabled,
  isMapsFeatureEnabled,
  isNotesFeatureEnabled,
} from "@/lib/workspace/workspaceSettings";

export type WorkspaceNavViewId =
  | "home"
  | "tasks"
  | "notes"
  | "notebooks"
  | "meetings"
  | "lists"
  | "chat"
  | "health"
  | "map"
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

export type MobileMoreNavGroupId = "work" | "team" | "insights" | "workspace";

export type MobileMoreNavItem = WorkspaceNavView & {
  group: MobileMoreNavGroupId;
  groupLabel: string;
  hint?: string;
};

/** Daily-use tabs on phones. Everything else lives in More. */
export const MOBILE_PRIMARY_NAV_IDS = ["home", "tasks", "notes", "lists"] as const;

const MOBILE_PRIMARY_NAV_ID_SET = new Set<string>(MOBILE_PRIMARY_NAV_IDS);

const MOBILE_MORE_GROUP_LABELS: Record<MobileMoreNavGroupId, string> = {
  work: "Work",
  team: "Team",
  insights: "Insights",
  workspace: "Workspace",
};

const MOBILE_MORE_META: Partial<
  Record<WorkspaceNavViewId, { group: MobileMoreNavGroupId; hint?: string }>
> = {
  notebooks: { group: "work", hint: "Notebooks and writing" },
  meetings: { group: "work", hint: "Agendas and follow-ups" },
  chat: { group: "team", hint: "Workspace messages" },
  teams: { group: "team", hint: "Members and invites" },
  health: { group: "insights", hint: "Habits and tracking" },
  map: { group: "insights", hint: "Territories and stores" },
  settings: { group: "workspace", hint: "Features and preferences" },
  admin: { group: "workspace", hint: "Site administration" },
};

const MOBILE_MORE_GROUP_ORDER: MobileMoreNavGroupId[] = [
  "work",
  "team",
  "insights",
  "workspace",
];

const ALL_VIEWS: WorkspaceNavView[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "tasks", label: "Tasks", icon: Check },
  { id: "notes", label: "Files", icon: FolderOpen },
  { id: "notebooks", label: "Notes", icon: Notebook },
  { id: "meetings", label: "Meetings", icon: Calendar },
  { id: "lists", label: "Lists", icon: ListChecks },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "map", label: "Map", icon: MapPinned },
  { id: "teams", label: "Team", icon: Users },
  {
    id: "settings",
    label: "Workspace Settings",
    shortLabel: "Settings",
    icon: Settings,
  },
];

const ADMIN_VIEW: WorkspaceNavView = {
  id: "admin",
  label: "Admin",
  icon: Shield,
};

function isViewVisible(
  id: WorkspaceNavViewId,
  workspace: Workspace,
  opts?: WorkspaceNavOptions,
): boolean {
  if (id === "chat") return opts?.showChat === true;
  if (id === "notebooks" || id === "meetings") return isNotesFeatureEnabled(workspace.settings);
  if (id === "health") return isHealthFeatureEnabled(workspace.settings);
  if (id === "map") return isMapsFeatureEnabled(workspace.settings);
  return true;
}

/** All routable workspace views — URL validity, command palette, deep links. */
export function getBottomNavViews(
  workspace: Workspace,
  opts?: WorkspaceNavOptions,
): WorkspaceNavView[] {
  return ALL_VIEWS.filter((v) => isViewVisible(v.id, workspace, opts));
}

export function isMobilePrimaryNavView(id: string): boolean {
  return MOBILE_PRIMARY_NAV_ID_SET.has(id);
}

/** Four daily-use tabs for the mobile bar. Feature-hidden views are omitted. */
export function getMobilePrimaryNavViews(
  workspace: Workspace,
  opts?: WorkspaceNavOptions,
): WorkspaceNavView[] {
  return getBottomNavViews(workspace, opts).filter((v) => isMobilePrimaryNavView(v.id));
}

function toMoreItem(view: WorkspaceNavView): MobileMoreNavItem {
  const meta = MOBILE_MORE_META[view.id] ?? { group: "workspace" as const };
  return {
    ...view,
    group: meta.group,
    groupLabel: MOBILE_MORE_GROUP_LABELS[meta.group],
    hint: meta.hint,
  };
}

/**
 * Overflow destinations for the mobile More sheet.
 * Includes Admin when the signed-in user is a site admin.
 */
export function getMobileMoreNavViews(
  workspace: Workspace,
  opts?: WorkspaceNavOptions,
): MobileMoreNavItem[] {
  const overflow = getBottomNavViews(workspace, opts)
    .filter((v) => !isMobilePrimaryNavView(v.id))
    .map(toMoreItem);

  if (opts?.isSiteAdmin) {
    overflow.push(toMoreItem(ADMIN_VIEW));
  }

  return overflow;
}

export function getMobileMoreNavGroups(
  workspace: Workspace,
  opts?: WorkspaceNavOptions,
): Array<{ id: MobileMoreNavGroupId; label: string; items: MobileMoreNavItem[] }> {
  const items = getMobileMoreNavViews(workspace, opts);
  return MOBILE_MORE_GROUP_ORDER.map((id) => ({
    id,
    label: MOBILE_MORE_GROUP_LABELS[id],
    items: items.filter((item) => item.group === id),
  })).filter((group) => group.items.length > 0);
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
  if (view === "calendar" || view === "today" || view === "files") return true;
  const allowed = new Set([
    ...getBottomNavViews(workspace, opts).map((v) => v.id),
    ...(opts?.isSiteAdmin ? (["admin"] as const) : []),
  ]);
  return allowed.has(view as WorkspaceNavViewId);
}

export function resolveNavView(view: string): WorkspaceNavViewId {
  if (view === "calendar" || view === "today") return "home";
  if (view === "files") return "notes";
  return view as WorkspaceNavViewId;
}