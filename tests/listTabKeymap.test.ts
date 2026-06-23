import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { ListTabKeymap } from "@/lib/editor/listTabKeymap";

function createEditor(content?: object) {
  return new Editor({
    extensions: [
      StarterKit.configure({ link: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      ListTabKeymap,
    ],
    content: content ?? { type: "doc", content: [{ type: "paragraph" }] },
  });
}

describe("ListTabKeymap", () => {
  it("indents the second bullet list item on Tab", () => {
    const listItem = (text: string) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [listItem("First"), listItem("Second")],
        },
      ],
    });

    editor.commands.setTextSelection(12);
    const sunk = editor.commands.sinkListItem("listItem");
    expect(sunk).toBe(true);

    editor.destroy();
  });

  it("moves to the next table cell on Tab", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
                },
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
                },
              ],
            },
          ],
        },
      ],
    });

    editor.commands.focus(2);
    const moved = editor.commands.goToNextCell();
    expect(moved).toBe(true);

    editor.destroy();
  });
});