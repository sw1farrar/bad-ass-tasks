/**
 * Shared styles so agenda/summary note bodies keep TipTap formatting
 * in on-screen preview, PDF capture, and print documents.
 */
export function richEntryBodyPrintCss(selector: string): string {
  return `
  ${selector} {
    margin: 0;
    font-size: 9pt;
    color: #000000;
    white-space: normal;
    line-height: 1.4;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  ${selector} > :first-child { margin-top: 0 !important; }
  ${selector} > :last-child { margin-bottom: 0 !important; }
  ${selector} p {
    margin: 0 0 0.35em;
    padding: 0;
  }
  ${selector} h1,
  ${selector} h2,
  ${selector} h3 {
    margin: 0.4em 0 0.2em;
    padding: 0;
    font-weight: 700;
    line-height: 1.25;
    color: #000000;
  }
  ${selector} h1 { font-size: 12pt; }
  ${selector} h2 { font-size: 11pt; }
  ${selector} h3 { font-size: 10pt; }
  ${selector} strong { font-weight: 700; }
  ${selector} em { font-style: italic; }
  ${selector} a {
    color: #000000;
    text-decoration: underline;
  }
  ${selector} code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 8.5pt;
  }
  ${selector} pre {
    margin: 0.35em 0;
    padding: 0.35em 0.5em;
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    font-family: Consolas, "Courier New", monospace;
    font-size: 8.5pt;
    white-space: pre-wrap;
    word-break: break-word;
  }
  ${selector} pre code {
    font-size: inherit;
  }
  ${selector} blockquote {
    margin: 0.35em 0;
    padding: 0 0 0 0.75em;
    border-left: 2px solid #cccccc;
    color: #000000;
  }
  ${selector} ul,
  ${selector} ol {
    margin: 0.25em 0;
    padding: 0 0 0 1.35em;
  }
  ${selector} ul { list-style-type: disc; }
  ${selector} ol { list-style-type: decimal; }
  ${selector} li {
    margin: 0.1em 0;
    padding: 0;
  }
  ${selector} li > p {
    margin: 0;
  }
  ${selector} hr {
    margin: 0.5em 0;
    border: none;
    border-top: 1px solid #cccccc;
  }
  ${selector} table {
    width: 100%;
    margin: 0.35em 0;
    border-collapse: collapse;
    font-size: 9pt;
  }
  ${selector} th,
  ${selector} td {
    border: 1px solid #cccccc;
    padding: 2px 6px;
    text-align: left;
    vertical-align: top;
  }
  ${selector} th {
    font-weight: 700;
    background: #f4f4f5;
  }
  ${selector} img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0.35em 0;
  }
`;
}

/** Inline styles for Word/email paste (class CSS is often stripped). */
export const RICH_ENTRY_INLINE = {
  p: "margin:0 0 0.35em;padding:0;",
  h1: "margin:0.4em 0 0.2em;padding:0;font-size:12pt;font-weight:700;line-height:1.25;color:#000000;",
  h2: "margin:0.35em 0 0.15em;padding:0;font-size:11pt;font-weight:700;line-height:1.25;color:#000000;",
  h3: "margin:0.3em 0 0.15em;padding:0;font-size:10pt;font-weight:700;line-height:1.25;color:#000000;",
  ul: "margin:0.25em 0;padding:0 0 0 1.35em;list-style-type:disc;",
  ol: "margin:0.25em 0;padding:0 0 0 1.35em;list-style-type:decimal;",
  li: "margin:0.1em 0;padding:0;",
  blockquote: "margin:0.35em 0;padding:0 0 0 0.75em;border-left:2px solid #cccccc;color:#000000;",
  pre: 'margin:0.35em 0;padding:0.35em 0.5em;background:#f4f4f5;border:1px solid #e4e4e7;font-family:Consolas,"Courier New",monospace;font-size:8.5pt;white-space:pre-wrap;',
  code: 'font-family:Consolas,"Courier New",monospace;font-size:8.5pt;',
  table: "width:100%;margin:0.35em 0;border-collapse:collapse;font-size:9pt;",
  th: "border:1px solid #cccccc;padding:2px 6px;text-align:left;vertical-align:top;font-weight:700;background:#f4f4f5;",
  td: "border:1px solid #cccccc;padding:2px 6px;text-align:left;vertical-align:top;",
  img: "display:block;max-width:100%;height:auto;margin:0.35em 0;",
  hr: "margin:0.5em 0;border:none;border-top:1px solid #cccccc;",
  strong: "font-weight:700;",
  em: "font-style:italic;",
  a: "color:#000000;text-decoration:underline;",
} as const;
