import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { EmailHtmlBlockNodeView } from "./email-html-block-node-view";

/** Preserves inbound email HTML layout inside the rich editor. */
export const EmailHtmlBlock = Node.create({
  name: "emailHtmlBlock",

  addOptions() {
    return {
      noteId: "",
    };
  },

  group: "block",

  atom: true,

  selectable: true,

  draggable: false,

  addAttributes() {
    return {
      html: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-html") ?? "",
        renderHTML: (attributes) => {
          if (!attributes.html) return {};
          return { "data-html": attributes.html };
        },
      },
      styles: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-styles") ?? "",
        renderHTML: (attributes) => {
          if (!attributes.styles) return {};
          return { "data-styles": attributes.styles };
        },
      },
      pipelineVersion: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-pipeline-version");
          if (!raw) return null;
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attributes) => {
          if (attributes.pipelineVersion == null) return {};
          return { "data-pipeline-version": String(attributes.pipelineVersion) };
        },
      },
      noteId: {
        default: "",
        parseHTML: () => "",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="email-html-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "email-html-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmailHtmlBlockNodeView);
  },
});