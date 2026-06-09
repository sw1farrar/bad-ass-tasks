import { describe, it, expect } from "vitest";
import {
  buildInboundNoteContentJson,
  htmlToTipTapDoc,
  replaceCidImagesInTipTapDoc,
  safeBuildInboundNoteContentJson,
} from "@/lib/notes/emailHtmlToTipTap";
import {
  displayStoredEmailHtml,
  expandMsoConditionalHtml,
  extractEmailBodyFragment,
  extractEmailStyleBlocks,
  inlineEmailStyles,
  normalizeTableCellDisplay,
  prepareInboundEmailHtml,
  preserveEmailImagesFaithfully,
  replaceCidSourcesInHtml,
  sanitizeInboundEmailHtml,
} from "@/lib/notes/sanitizeInboundEmailHtml";
import { EMAIL_PIPELINE_VERSION } from "@/lib/notes/emailPipeline";
import { extractNoteSearchText } from "@/lib/notes/extractNoteSearchText";
import { buildEmailSrcdoc } from "@/lib/notes/emailDocument";

describe("emailHtmlToTipTap", () => {
  it("strips script tags from inbound HTML", () => {
    const sanitized = sanitizeInboundEmailHtml(
      '<p>Hello</p><script>alert("xss")</script>',
    );
    expect(sanitized).not.toContain("script");
    expect(sanitized).toContain("Hello");
  });

  it("extracts body from full HTML documents", () => {
    const fragment = extractEmailBodyFragment(
      "<!DOCTYPE html><html><head><title>x</title></head><body><p>Receipt</p></body></html>",
    );
    expect(fragment).toContain("Receipt");
    expect(fragment).not.toContain("<head");
  });

  it("inlines extracted stylesheet rules into HTML", () => {
    const html = `<!DOCTYPE html><html><head><style>.total { color: #111111; font-weight: 700; }</style></head><body><p class="total">$42</p></body></html>`;
    const css = extractEmailStyleBlocks(html);
    expect(css).toContain(".total");
    const prepared = prepareInboundEmailHtml(html);
    expect(prepared.html).toContain("$42");
    expect(prepared.html).toMatch(/color:\s*#111111/i);
  });

  it("preserves table layout in emailHtmlBlock", () => {
    const html = `<table width="600" cellpadding="0"><tr><td style="color:#111111;padding:12px">Total $42.00</td></tr></table>`;
    const doc = buildInboundNoteContentJson({
      From: { Address: "store@example.com" },
      Subject: "Receipt",
      RawHtmlBody: html,
    }) as { content: Array<{ type: string; attrs?: { html?: string; styles?: string } }> };

    const block = doc.content.find((n) => n.type === "emailHtmlBlock");
    expect(block).toBeDefined();
    expect(block?.attrs?.html).toContain("<table");
    expect(block?.attrs?.html).toContain("Total $42.00");
    expect(block?.attrs?.html).toContain("padding");
  });

  it("stores sanitized HTML instead of flattening to plain paragraphs", () => {
    const doc = htmlToTipTapDoc("<p>Hello <strong>world</strong></p>");
    expect(doc).toMatchObject({
      type: "doc",
      content: [
        expect.objectContaining({
          type: "emailHtmlBlock",
          attrs: expect.objectContaining({
            html: expect.stringContaining("Hello"),
          }),
        }),
      ],
    });
  });

  it("falls back to plain text when HTML parses empty", () => {
    const doc = buildInboundNoteContentJson({
      From: { Address: "sender@example.com" },
      RawHtmlBody: "<html><head><style>.x{}</style></head><body></body></html>",
      RawTextBody: "Plain fallback body",
    });
    const serialized = JSON.stringify(doc);
    expect(serialized).toContain("Plain fallback body");
    expect(serialized).not.toContain("emailHtmlBlock");
  });

  it("replaces cid image sources and preserves dimensions on self-closing img tags", () => {
    const prepared = prepareInboundEmailHtml('<img src="cid:logo123" alt="Logo" width="120" />', {
      logo123: "https://cdn.example/logo.png",
    });
    expect(prepared.html).toContain('src="https://cdn.example/logo.png"');
    expect(prepared.html).toContain('width="120"');
    expect(prepared.html).not.toMatch(/\/\s*style=/);
    expect(prepared.html).toMatch(/<img[^>]+style="[^"]*max-width:100%/i);
  });

  it("fixes self-closing img tags from sanitizer output", () => {
    const fixed = preserveEmailImagesFaithfully('<img src="x.png" width="64" height="64" />');
    expect(fixed).not.toMatch(/\/\s*style=/);
    expect(fixed).toMatch(/<img[^>]+width="64"/);
    expect(fixed).toMatch(/style="[^"]*max-width:100%/);
  });

  it("replaces cid sources in TipTap emailHtmlBlock nodes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "emailHtmlBlock",
          attrs: { html: '<img src="cid:logo123" alt="Logo">' },
        },
      ],
    };
    const updated = replaceCidImagesInTipTapDoc(doc, {
      logo123: "https://cdn.example/logo.png",
    });
    expect((updated as { content: Array<{ attrs: { html: string } }> }).content[0].attrs.html).toContain(
      "https://cdn.example/logo.png",
    );
  });

  it("preserves oversized receipt image dimensions with overflow guard only", () => {
    const prepared = prepareInboundEmailHtml(
      '<img src="https://x.test/receipt.png" width="800" style="width:800px;height:600px;display:block;">',
    );
    expect(prepared.html).toContain('width="800"');
    expect(prepared.html).toMatch(/width:\s*800px/i);
    expect(prepared.html).toMatch(/height:\s*600px/i);
    expect(prepared.html).toMatch(/max-width:\s*100%/i);
  });

  it("includes sender metadata above the email block", () => {
    const doc = buildInboundNoteContentJson({
      From: { Name: "Store", Address: "store@example.com" },
      Subject: "Receipt",
      SentAtDate: "Sun, 7 Jun 2026 12:00:00 +0000",
      RawHtmlBody: "<p>Thanks for your order</p>",
    }) as { content: Array<{ type: string; content?: Array<{ text?: string }> }> };

    expect(doc.content[0]?.content?.[0]?.text).toContain("From: Store");
    expect(doc.content.some((n) => n.type === "emailHtmlBlock")).toBe(true);
  });

  it("replaceCidSourcesInHtml handles background attributes", () => {
    const html = '<td background="cid:bg123">Cell</td>';
    const out = replaceCidSourcesInHtml(html, { bg123: "https://cdn.example/bg.png" });
    expect(out).toContain('background="https://cdn.example/bg.png"');
  });

  it("preserves class-based receipt styling via CSS inlining", () => {
    const html = `<!DOCTYPE html><html><head>
      <style>
        .line-item td { padding: 8px 12px; border-bottom: 1px solid #eee; }
        .amount { text-align: right; font-weight: 700; }
      </style>
    </head><body>
      <table class="line-item"><tr><td>Widget</td><td class="amount">$19.99</td></tr></table>
    </body></html>`;
    const prepared = prepareInboundEmailHtml(html);
    expect(prepared.html).toContain("$19.99");
    expect(prepared.html).toMatch(/padding:\s*8px\s+12px/i);
    expect(prepared.html).toMatch(/text-align:\s*right/i);
  });

  it("preserves flex gap in modern transactional layouts", () => {
    const html =
      '<div style="display:flex;flex-direction:row;align-items:center;gap:16px"><img width="48" src="https://x.test/a.png"><span>Hello</span></div>';
    const prepared = prepareInboundEmailHtml(html);
    expect(prepared.html).toMatch(/display:\s*flex/i);
    expect(prepared.html).toMatch(/gap:\s*16px/i);
  });

  it("normalizes inline-block on table cells to table-cell", () => {
    const html =
      '<table><tr><td style="display:inline-block;width:33.33%;padding:10px">A</td><td style="display:inline-block;width:33.33%;padding:10px">B</td></tr></table>';
    const normalized = normalizeTableCellDisplay(html);
    expect(normalized).toContain("display:table-cell");
    expect(normalized).not.toContain("display:inline-block");
  });

  it("expands MSO conditional table wrappers", () => {
    const html = `<!--[if mso]><table><tr><td><![endif]--><div>Content</div><!--[if mso]></td></tr></table><![endif]-->`;
    const expanded = expandMsoConditionalHtml(html);
    expect(expanded).toContain("<table>");
    expect(expanded).not.toContain("[if mso]");
  });

  it("keeps logo and heading side by side in presentation table rows", () => {
    const html = `<table width="100%"><tr>
      <td width="80" style="vertical-align:middle"><img src="https://x.test/logo.png" width="64" height="64" alt="Logo"></td>
      <td style="vertical-align:middle;padding-left:12px"><h1 style="margin:0">Newsletter</h1></td>
    </tr></table>`;
    const prepared = prepareInboundEmailHtml(html);
    expect(prepared.html).toContain("<table");
    expect(prepared.html).toContain('width="64"');
    expect(prepared.html).toMatch(/vertical-align:\s*middle/i);
    expect(prepared.html).toContain("Newsletter");
  });

  it("buildEmailSrcdoc wraps body in a full HTML document", () => {
    const srcdoc = buildEmailSrcdoc("<p>Hi</p>", "");
    expect(srcdoc).toContain("<!DOCTYPE html>");
    expect(srcdoc).toContain("email-message-root");
    expect(srcdoc).toContain("<p>Hi</p>");
  });

  it("buildEmailSrcdoc strips script tags for sandboxed iframe render", () => {
    const srcdoc = buildEmailSrcdoc(
      '<p>Hi</p><script>alert("xss")</script>',
      "",
    );
    expect(srcdoc).not.toContain("<script");
    expect(srcdoc).toContain("<p>Hi</p>");
  });

  it("inlineEmailStyles applies class rules to elements", () => {
    const inlined = inlineEmailStyles(
      '<p class="title">Hello</p>',
      ".title { font-size: 24px; color: #333; }",
    );
    expect(inlined.html).toMatch(/font-size:\s*24px/i);
    expect(inlined.html).toMatch(/color:\s*#333/i);
    expect(inlined.cssFallback).toBe("");
  });

  it("unwraps !mso conditional blocks instead of deleting them", () => {
    const html = `<!--[if !mso]><div class="modern-only">Modern layout</div><![endif]-->`;
    const expanded = expandMsoConditionalHtml(html);
    expect(expanded).toContain("Modern layout");
    expect(expanded).not.toContain("[if !mso]");
  });

  it("initial insert includes emailHtmlBlock even before CID resolution", () => {
    const doc = buildInboundNoteContentJson({
      From: { Address: "store@example.com" },
      Subject: "Receipt",
      RawHtmlBody: '<img src="cid:logo" alt="Logo">',
    });
    const serialized = JSON.stringify(doc);
    expect(serialized).toContain("emailHtmlBlock");
    expect(serialized).toContain("cid:logo");
    expect(serialized).not.toContain("Processing email");
  });

  it("safeBuildInboundNoteContentJson returns a doc even when html pipeline throws", () => {
    const doc = safeBuildInboundNoteContentJson({
      From: { Address: "broken@example.com" },
      RawHtmlBody: "<p>Hello</p>",
    });
    expect(doc).toMatchObject({ type: "doc" });
  });

  it("displayStoredEmailHtml does not re-juice current pipeline notes", () => {
    const html = '<p class="x">Hi</p>';
    const styles = ".x { color: red; }";
    const current = displayStoredEmailHtml(html, styles, EMAIL_PIPELINE_VERSION);
    expect(current.html).toBe(html);
    expect(current.extraCss).toContain("color: red");
  });

  it("extractNoteSearchText includes emailHtmlBlock body", () => {
    const doc = buildInboundNoteContentJson({
      From: { Address: "a@b.com" },
      RawHtmlBody: "<p>Hidden receipt total $99</p>",
    });
    const text = extractNoteSearchText(doc);
    expect(text).toContain("$99");
  });

  describe("regression fixtures", () => {
    it("preserves three-column receipt table with MSO gutters", () => {
      const html = `<!DOCTYPE html><html><head><style>
        .col { width: 33.33%; padding: 8px; vertical-align: top; }
      </style></head><body>
      <!--[if mso]><table><tr><td><![endif]-->
      <table width="100%"><tr>
        <td class="col">Item A</td>
        <td class="col">Item B</td>
        <td class="col">$42.00</td>
      </tr></table>
      <!--[if mso]></td></tr></table><![endif]-->
      </body></html>`;
      const prepared = prepareInboundEmailHtml(html);
      expect(prepared.html).toContain("Item A");
      expect(prepared.html).toContain("$42.00");
      expect(prepared.html).toMatch(/width:\s*33\.33%/i);
    });

    it("preserves button-styled anchors from marketing emails", () => {
      const html = `<a href="https://example.com/cta" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:4px">Shop now</a>`;
      const prepared = prepareInboundEmailHtml(html);
      expect(prepared.html).toContain("Shop now");
      expect(prepared.html).toMatch(/background-color:\s*#2563eb/i);
      expect(prepared.html).toMatch(/display:\s*inline-block/i);
    });

    it("resolves multiple cid: variants in one pass", () => {
      const html = `<img src="cid:logo@sender"> and <td background="cid:bg@sender">`;
      const prepared = prepareInboundEmailHtml(html, {
        "logo@sender": "https://cdn/logo.png",
        "bg@sender": "https://cdn/bg.png",
      });
      expect(prepared.html).toContain("https://cdn/logo.png");
      expect(prepared.html).toContain('background="https://cdn/bg.png"');
    });
  });
});