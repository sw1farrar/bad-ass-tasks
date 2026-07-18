"use client";

import React, { useState } from "react";
import { Repeat } from "lucide-react";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { DateTimePicker } from "@/components/DateTimePicker";
import { TaskAssigneePicker } from "@/components/TaskAssigneePicker";
import { resolveAssigneeLabel } from "@/lib/assignee";
import { getRecurringLabel } from "@/lib/utils";
import type { Task, WorkspaceMember } from "@/types";
import {
  buildDueDateUpdates,
  buildRecurringDueDateChange,
  type RecurringDueDateScope,
} from "@/features/tasks/lib/recurrenceTaskState";
import { RecurringDueDateScopeModal } from "./RecurringDueDateScopeModal";
import { TaskLinkedFilesSection } from "./TaskLinkedFilesSection";
import { TaskOrganizeFields } from "./TaskOrganizeFields";
import { TaskRecurrenceEditor } from "./TaskRecurrenceEditor";

interface TaskModalScheduleFieldsProps {
  localTask: Task;
  save: (updates: Partial<Task>) => void | Promise<void>;
  members: WorkspaceMember[];
  currentUserId?: string;
  disabled?: boolean;
  onOpenLinkedNote?: (noteId: string) => void;
  onEndIncompleteChange?: (incomplete: boolean) => void;
}

export function TaskModalScheduleFields({
  localTask,
  save,
  members,
  currentUserId,
  disabled = false,
  onOpenLinkedNote,
  onEndIncompleteChange,
}: TaskModalScheduleFieldsProps) {
  const [pendingDue, setPendingDue] = useState<string | null | undefined>(undefined);
  const [dueScopeOpen, setDueScopeOpen] = useState(false);

  const applyDueChange = (dateStr: string | null | undefined, scope: RecurringDueDateScope = "series") => {
    if (!dateStr) {
      void save(buildDueDateUpdates(null));
      return;
    }
    if (localTask.recurringRule) {
      void save(buildRecurringDueDateChange(localTask, dateStr, scope));
      return;
    }
    void save(buildDueDateUpdates(dateStr));
  };

  const handleDuePickerChange = (dateStr: string | null | undefined) => {
    if (!dateStr) {
      applyDueChange(null);
      return;
    }
    if (localTask.recurringRule && (localTask.dueDate ?? null) !== dateStr) {
      setPendingDue(dateStr);
      setDueScopeOpen(true);
      return;
    }
    applyDueChange(dateStr);
  };

  return (
    <>
      <DateTimePicker
        label="Due date"
        value={localTask.dueDate}
        onChange={handleDuePickerChange}
        className="w-full tasks-editable-field"
      />

      {localTask.dueDate ? (
        <CollapsibleSection
          key={`repeat-${localTask.id}`}
          title="Repeat"
          icon={Repeat}
          badge={getRecurringLabel(localTask.recurringRule) || "None"}
          defaultOpen={!!localTask.recurringRule}
          dense
        >
          <div className="space-y-2 pt-1">
            <TaskRecurrenceEditor
              localTask={localTask}
              save={save}
              compact
              onEndIncompleteChange={onEndIncompleteChange}
            />
          </div>
        </CollapsibleSection>
      ) : null}

      <TaskAssigneePicker
        members={members}
        currentUserId={currentUserId}
        value={localTask.assigneeIds?.[0] ?? null}
        onChange={(userId) => {
          const assigneeIds = userId ? [userId] : [];
          const assignee = resolveAssigneeLabel(assigneeIds, members, currentUserId);
          void save({ assigneeIds, assignee });
        }}
        compact
      />

      <TaskOrganizeFields
        starred={!!localTask.starred}
        folderId={localTask.folderId}
        disabled={disabled}
        compact
        onStarredChange={(next) => void save({ starred: next })}
        onFolderChange={(folderId) => void save({ folderId })}
      />

      <TaskLinkedFilesSection
        task={localTask}
        compact
        onOpenNote={onOpenLinkedNote}
        onTaskLinksChange={(linkedNoteIds) => {
          void save({ linkedNoteIds });
        }}
      />

      <RecurringDueDateScopeModal
        open={dueScopeOpen}
        taskTitle={localTask.title}
        onCancel={() => {
          setDueScopeOpen(false);
          setPendingDue(undefined);
        }}
        onChoose={(scope) => {
          const dateStr = pendingDue;
          setDueScopeOpen(false);
          setPendingDue(undefined);
          if (dateStr !== undefined) applyDueChange(dateStr, scope);
        }}
      />
    </>
  );
}
