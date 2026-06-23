import { Extension } from "@tiptap/core";

/**
 * Word-style editing shortcuts:
 * - Tab / Shift+Tab in lists: indent/outdent items
 * - Tab / Shift+Tab in tables: move between cells
 */
export const ListTabKeymap = Extension.create({
  name: "listTabKeymap",

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("table")) {
          return this.editor.chain().focus().goToNextCell().run();
        }
        if (this.editor.isActive("listItem")) {
          return this.editor.chain().focus().sinkListItem("listItem").run();
        }
        return false;
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("table")) {
          return this.editor.chain().focus().goToPreviousCell().run();
        }
        if (this.editor.isActive("listItem")) {
          return this.editor.chain().focus().liftListItem("listItem").run();
        }
        return false;
      },
    };
  },
});