import { stripEmailExecutableMarkup } from "@/lib/notes/sanitizeInboundEmailHtml";

/**
 * Build a complete HTML document for faithful email rendering (iframe srcdoc).
 * Matches how Gmail/Front isolate sender HTML in its own document context.
 */

const EMAIL_VIEWPORT_MAX_PX = 640;

/** Minimal document shell — does not override sender typography or link colors. */
const EMAIL_IFRAME_BASE_CSS = `
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    -webkit-text-size-adjust: 100%;
  }
  body {
    background: #ffffff;
  }
  .email-message-root {
    margin: 0 auto;
    max-width: ${EMAIL_VIEWPORT_MAX_PX}px;
    width: 100%;
    box-sizing: border-box;
  }
  img {
    border: 0;
    outline: none;
    text-decoration: none;
    -ms-interpolation-mode: bicubic;
  }
  table {
    border-collapse: collapse;
    mso-table-lspace: 0pt;
    mso-table-rspace: 0pt;
  }
`;

export function buildEmailSrcdoc(bodyHtml: string, extraCss = ""): string {
  const safeBody = stripEmailExecutableMarkup(bodyHtml.trim()) || "<p></p>";
  const safeCss = extraCss.trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank" rel="noopener noreferrer">
<style>${EMAIL_IFRAME_BASE_CSS}${safeCss ? `\n${safeCss}` : ""}</style>
</head>
<body>
<div class="email-message-root">
${safeBody}
</div>
</body>
</html>`;
}