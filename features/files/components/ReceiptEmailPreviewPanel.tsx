"use client";

import { useEffect, useRef } from "react";
import type { ReceiptEmailPreviewContent } from "@/lib/files/receiptPreview";

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

  return root;
}

interface ReceiptEmailPreviewPanelProps {
  preview: ReceiptEmailPreviewContent;
}

export function ReceiptEmailPreviewPanel({ preview }: ReceiptEmailPreviewPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !preview.bodyHtml) return;

    const root = mountEmailShadowRoot(host, preview.bodyHtml, preview.css);
    const sync = () => {
      const height = Math.ceil(
        Math.max(root.scrollHeight, root.getBoundingClientRect().height),
      );
      host.style.minHeight = `${Math.max(height, 120)}px`;
    };

    sync();
    requestAnimationFrame(sync);

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    resizeObserver?.observe(root);

    root.querySelectorAll("img").forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", sync, { once: true });
        img.addEventListener("error", sync, { once: true });
      }
    });

    return () => {
      resizeObserver?.disconnect();
      host.style.minHeight = "";
    };
  }, [preview.bodyHtml, preview.css]);

  if (preview.plainTextFallback && !preview.bodyHtml) {
    return (
      <div className="receipt-email-preview-panel__plain whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
        {preview.plainTextFallback}
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="receipt-email-preview-panel__body w-full bg-white"
      aria-label="Inbound email content"
    />
  );
}