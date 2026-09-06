import type { Priority, TaskStatus } from "@/types";

export type ImportPlatformId = "toodledo";

export type ImportKind = "current" | "completed";

export type MappedImportTask = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  completedAt?: string;
  recurringRule?: string | null;
  starred: boolean;
  tags: string[];
  timeEstimate?: number;
  folderName: string | null;
  fingerprint: string;
  unmappedRepeat?: string;
};

export type ToodledoImportPreview = {
  kind: ImportKind;
  rowCount: number;
  recurringCount: number;
  notesCount: number;
  folderNames: string[];
  unmappedRepeats: string[];
  tasks: MappedImportTask[];
};

export type ImportPlatformOption = {
  id: ImportPlatformId | "todoist" | "apple_reminders" | "csv";
  label: string;
  available: boolean;
};
