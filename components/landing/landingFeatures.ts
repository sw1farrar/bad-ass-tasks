import type { LucideIcon } from "lucide-react";
import {
  CheckSquare,
  FileText,
  Home,
  LayoutList,
  StickyNote,
  Users,
} from "lucide-react";

export interface LandingFeatureScreenshot {
  desktopSrc: string;
  mobileSrc?: string;
  caption?: string;
  imageAlt: string;
}

export interface LandingFeatureSection {
  id: string;
  navLabel: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  screenshots: LandingFeatureScreenshot[];
  emailCallout?: {
    title: string;
    body: string;
  };
}

export const LANDING_FEATURE_SECTIONS: LandingFeatureSection[] = [
  {
    id: "home",
    navLabel: "Home",
    icon: Home,
    eyebrow: "Home",
    title: "Start every day knowing what matters",
    description:
      "A single dashboard surfaces due-now tasks, overdue work, and what needs your attention — across every workspace you belong to.",
    highlights: [
      "Due now, overdue, and upcoming in one view",
      "Workspace pulse with open counts at a glance",
      "Attention items that surface what you might miss",
      "One tap into tasks, lists, notes, or files",
    ],
    screenshots: [
      {
        desktopSrc: "/landing/screenshots/desktop-home.png",
        mobileSrc: "/landing/screenshots/mobile-home.png",
        imageAlt: "Badazz Tasks Home view showing due-now tasks and workspace overview",
      },
    ],
  },
  {
    id: "tasks",
    navLabel: "Tasks",
    icon: CheckSquare,
    eyebrow: "Tasks",
    title: "Capture, prioritize, and ship",
    description:
      "A focused task list built for speed — add in seconds, set priorities and deadlines, assign to teammates, and filter down to exactly what you're working on.",
    highlights: [
      "Quick-add from anywhere in the app",
      "Priorities, deadlines, tags, and assignees",
      "Filter by status, person, or workspace",
      "Link tasks to notes and lists for full context",
    ],
    screenshots: [
      {
        desktopSrc: "/landing/screenshots/desktop-tasks.png",
        mobileSrc: "/landing/screenshots/mobile-tasks.png",
        imageAlt: "Badazz Tasks list with priorities, filters, and quick-add",
      },
    ],
  },
  {
    id: "notes",
    navLabel: "Notes",
    icon: StickyNote,
    eyebrow: "Notes",
    title: "Think in rich documents, not plain text",
    description:
      "A beautiful editor for real work — images, attachments, email imports, and linked tasks live together in documents your whole team can open.",
    highlights: [
      "Rich editor with images and file attachments",
      "Import and render inbound email content",
      "Link tasks directly inside any note",
      "Fast on desktop and polished on mobile",
    ],
    screenshots: [
      {
        desktopSrc: "/landing/screenshots/desktop-notes.png",
        mobileSrc: "/landing/screenshots/mobile-notes.png",
        imageAlt: "Badazz Tasks Notes editor with tree navigation and rich content",
      },
    ],
  },
  {
    id: "lists",
    navLabel: "Lists",
    icon: LayoutList,
    eyebrow: "Lists",
    title: "Checklists that stay organized",
    description:
      "Color-coded lists with nested items, drag-and-drop reordering, and satisfying completion feedback — perfect for runbooks, packing lists, and project breakdowns.",
    highlights: [
      "Nested items with drag-and-drop reorder",
      "Color-coded lists you can pin to Home",
      "Show or hide completed items on demand",
      "Open counts surface on your dashboard",
    ],
    screenshots: [
      {
        desktopSrc: "/landing/screenshots/desktop-lists.png",
        mobileSrc: "/landing/screenshots/mobile-lists.png",
        imageAlt: "Badazz Tasks Lists workspace with color-coded checklists",
      },
    ],
  },
  {
    id: "files",
    navLabel: "Files",
    icon: FileText,
    eyebrow: "Files",
    title: "Every document, tagged and reviewable",
    description:
      "A file stream for everything your team files — tag it, search it, approve inbound items from Review, and connect files back to notes.",
    highlights: [
      "Generate a custom workspace email in Settings",
      "Forward mail and attachments straight into Review",
      "Subject becomes the title; body and files preserved",
      "Approve, tag, and tie intake to notes and tasks",
    ],
    emailCallout: {
      title: "Custom files review email",
      body: "Create one private address per workspace. Anyone can email files to it — they land in Files → Review for your team to approve.",
    },
    screenshots: [
      {
        desktopSrc: "/landing/screenshots/desktop-files.png",
        mobileSrc: "/landing/screenshots/mobile-files.png",
        caption: "Files → Review queue",
        imageAlt: "Badazz Tasks Files view with Review queue for inbound documents",
      },
      {
        desktopSrc: "/landing/screenshots/desktop-files-email.png",
        mobileSrc: "/landing/screenshots/mobile-files-email.png",
        caption: "Workspace Settings → Files review email",
        imageAlt:
          "Badazz Tasks Settings showing a generated custom workspace email for files intake",
      },
    ],
  },
  {
    id: "team",
    navLabel: "Team",
    icon: Users,
    eyebrow: "Team",
    title: "Built for how teams actually work",
    description:
      "Invite teammates, assign roles, get notified when work moves, and keep conversations inside the workspace — so nothing falls through the cracks.",
    highlights: [
      "Invite teammates by email in seconds",
      "Role-based access per workspace",
      "Real-time notifications for what changed",
      "Workspace chat alongside your work",
    ],
    screenshots: [
      {
        desktopSrc: "/landing/screenshots/desktop-team.png",
        mobileSrc: "/landing/screenshots/mobile-team.png",
        imageAlt: "Badazz Tasks Team view with members and workspace roles",
      },
    ],
  },
];