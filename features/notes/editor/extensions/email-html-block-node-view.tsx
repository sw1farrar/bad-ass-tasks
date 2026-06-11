"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ChevronDown, ChevronUp, FileText, Printer, RefreshCw } from "lucide-react";
import { buildEmailShadowContent, buildEmailSrcdoc } from "@/lib/notes/emailDocument";
import { displayStoredEmailHtml } from "@/lib/notes/sanitizeInboundEmailHtml";
import {
  emailHtmlToEditableDoc,
  isSimpleEmailHtml,
} from "@/lib/notes/emailHtmlToPlainDoc";
import { toast } from "sonner";

function openEmailPrintWindow(srcdoc: string, title: string) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) {
    toast.error("Allow pop-ups to save as PDF");
    return;
  }
  win.document.write(srcdoc.replace("</head>", `<title>${title}</title></head>`));
  win.document.close();
  win.focus();
  win.print();
}

function mountEmailShadowRoot(host: HTMLDivElement, bodyHtml: string, css: string) {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  shadow.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = css;
  shadow.appendChild(style);

  const root = document.createElement("div");
  root.className = "email-message-root";
  root.innerHTML = bodyHtml;
  shadow.appendChild(root);

  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
}

/**
 * Renders inbound email HTML in an isolated shadow root (no sandboxed srcdoc iframe).
 * Display-time fixes only — full ingest runs once at webhook time.
 */
export function EmailHtmlBlockNodeView({ node, editor, getPos, extension }: NodeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const html = typeof node.attrs.html === "string" ? node.attrs.html : "";
  const styles = typeof node.attrs.styles === "string" ? node.attrs.styles : "";
  const pipelineVersion =
    typeof node.attrs.pipelineVersion === "number" ? node.attrs.pipelineVersion : undefined;
  const noteId =
    (extension.options as { noteId?: string }).noteId ||
    (typeof node.attrs.noteId === "string" ? node.attrs.noteId : "");

  const [collapsed, setCollapsed] = useState(false);
  const [rerendering, setRerendering] = useState(false);

  const { html: displayHtml, extraCss } = useMemo(
    () => displayStoredEmailHtml(html, styles, pipelineVersion),
    [html, styles, pipelineVersion],
  );

  const shadowContent = useMemo(
    () => (displayHtml ? buildEmailShadowContent(displayHtml, extraCss) : null),
    [displayHtml, extraCss],
  );

  const srcdoc = displayHtml ? buildEmailSrcdoc(displayHtml, extraCss) : "";

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !shadowContent || collapsed) return;
    mountEmailShadowRoot(host, shadowContent.bodyHtml, shadowContent.css);
  }, [shadowContent, collapsed]);

  const handleConvertToText = useCallback(() => {
    if (!html.trim()) return;
    if (!isSimpleEmailHtml(html)) {
      toast.error("This email has tables or images — conversion may lose layout");
      return;
    }

    const pos = getPos();
    if (typeof pos !== "number") return;

    const editable = emailHtmlToEditableDoc(html);
    const paragraphs = (editable as { content?: unknown[] }).content ?? [];

    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .insertContentAt(pos, paragraphs)
      .run();

    toast.success("Converted to editable text");
  }, [editor, getPos, html, node.nodeSize]);

  const handleRerender = useCallback(async () => {
    if (!noteId) {
      toast.error("Re-render requires a saved note");
      return;
    }

    setRerendering(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/rerender-email`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Re-render failed");
      }
      toast.success("Email re-rendered from source");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-render failed");
    } finally {
      setRerendering(false);
    }
  }, [noteId]);

  if (!html) {
    return (
      <NodeViewWrapper className="email-html-block my-3">
        <div className="email-html-render email-html-render--empty text-sm text-zinc-500 italic px-1">
          Empty email body
        </div>
      </NodeViewWrapper>
    );
  }

  const canConvert = isSimpleEmailHtml(html);

  return (
    <NodeViewWrapper className="email-html-block my-3" data-email-html-block>
      <div className="email-html-block__chrome flex flex-wrap items-center gap-2 mb-2 px-1">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          Original email
        </button>

        <div className="flex flex-wrap items-center gap-1 ml-auto">
          {canConvert && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1 rounded hover:bg-zinc-100"
              onClick={handleConvertToText}
              title="Replace with editable paragraphs"
            >
              <FileText className="w-3.5 h-3.5" />
              Convert to text
            </button>
          )}
          {noteId && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-50"
              onClick={handleRerender}
              disabled={rerendering}
              title="Re-run HTML pipeline from archived source"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rerendering ? "animate-spin" : ""}`} />
              Re-render
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1 rounded hover:bg-zinc-100"
            onClick={() => openEmailPrintWindow(srcdoc, "Email")}
            title="Print or save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div
          ref={hostRef}
          className="email-html-render w-full border-0 bg-white"
          aria-label="Inbound email content"
        />
      ) : null}
    </NodeViewWrapper>
  );
}