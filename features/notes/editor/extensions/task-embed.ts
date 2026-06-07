/**
 * TaskEmbed Node Extension for TipTap (Milestone 2)
 *
 * This is the foundation for live, editable task cards inside notes.
 * Goal: Allow users to type /task and get a rich, interactive task embed
 * that stays in sync with the main task system (bidirectional).
 *
 * Current state: Scaffolding + basic structure.
 * Future increments will add:
 *   - Real React NodeView renderer
 *   - Inline editing of status/priority
 *   - Drag to reorder, completion toggle
 *   - Parent passing live task data + update handlers
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TaskEmbedNodeView } from "./task-embed-node-view";

export interface TaskEmbedOptions {
  HTMLAttributes: Record<string, any>;
  tasks?: any[]; // Live tasks for rendering
  onOpenTask?: (taskId: string) => void;
  onToggleStatus?: (taskId: string) => Promise<void>;
  onUpdateTask?: (taskId: string, updates: Partial<any>) => Promise<void>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    taskEmbed: {
      /**
       * Insert a task embed node
       */
      insertTaskEmbed: (attributes?: { taskId?: string; title?: string }) => ReturnType;
    };
  }
}

export const TaskEmbed = Node.create<TaskEmbedOptions>({
  name: "taskEmbed",

  group: "block",

  atom: true, // Treat as a single unit (can't partially select inside for now)

  addAttributes() {
    return {
      taskId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-task-id"),
        renderHTML: (attributes) => {
          if (!attributes.taskId) return {};
          return { "data-task-id": attributes.taskId };
        },
      },
      title: {
        default: "Untitled Task",
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes) => {
          if (!attributes.title) return {};
          return { "data-title": attributes.title };
        },
      },
      status: {
        default: "todo",
        parseHTML: (element) => element.getAttribute("data-status"),
        renderHTML: (attributes) => ({ "data-status": attributes.status }),
      },
      priority: {
        default: "P2",
        parseHTML: (element) => element.getAttribute("data-priority"),
        renderHTML: (attributes) => ({ "data-priority": attributes.priority }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="task-embed"]' }];
  },

  // renderHTML is used when serializing to HTML (e.g. copy/paste or export).
  // The rich interactive version is handled by the React NodeView above.
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "task-embed",
        class: "task-embed-node",
      }),
      ["span", {}, HTMLAttributes.title || "Task"],
    ];
  },

  addCommands() {
    return {
      insertTaskEmbed:
        (attributes = {}) =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
              attrs: attributes,
            });
          },
    };
  },

  addNodeView() {
    const tasks = this.options.tasks || [];
    const onOpenTask = this.options.onOpenTask;
    const onToggleStatus = this.options.onToggleStatus;
    const onUpdateTask = this.options.onUpdateTask;
    return ReactNodeViewRenderer(TaskEmbedNodeView, {});
  },
});

export default TaskEmbed;