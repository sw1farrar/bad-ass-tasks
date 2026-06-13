import {
  sanitizeEmailCss,
  stripEmailExecutableMarkup,
  stripResidualExecutableMarkup,
} from "@/lib/notes/sanitizeInboundEmailHtml";

/**
 * Build email HTML for isolated rendering (shadow root or print window).
 * Matches how Gmail/Front isolate sender HTML in its own document context.
 */

/** Base layout rules for faithful email rendering inside an isolated root. */
export const EMAIL_DISPLAY_BASE_CSS = `
  :host {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    background: #ffffff;
  }
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
    margin: 0;
    width: max-content;
    min-width: 100%;
    max-width: none;
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
  a {
    color: inherit;
  }
`;

function sanitizeCssForSrcdoc(css: string): string {
  if (!css.trim()) return "";
  return stripResidualExecutableMarkup(sanitizeEmailCss(css).replace(/<[^>]+>/g, ""));
}

function sanitizeEmailBodyHtml(bodyHtml: string): string {
  return (
    stripResidualExecutableMarkup(stripEmailExecutableMarkup(bodyHtml.trim())) || "<p></p>"
  );
}

export type EmailShadowContent = {
  bodyHtml: string;
  css: string;
};

/** Sanitized markup for shadow-DOM email preview (no iframe / no srcdoc). */
export function buildEmailShadowContent(bodyHtml: string, extraCss = ""): EmailShadowContent {
  const safeBody = sanitizeEmailBodyHtml(bodyHtml);
  const safeCss = sanitizeCssForSrcdoc(extraCss);
  return {
    bodyHtml: safeBody,
    css: `${EMAIL_DISPLAY_BASE_CSS}${safeCss ? `\n${safeCss}` : ""}`,
  };
}

/** Block scripts in the isolated email document (sandbox has no allow-scripts). */
export const EMAIL_IFRAME_CSP =
  "default-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: https: http: cid: blob:; font-src data: https: http:; connect-src 'none';";

/** Full HTML document for print / PDF (pop-up window, not sandboxed iframe). */
export function buildEmailSrcdoc(bodyHtml: string, extraCss = ""): string {
  const safeBody = sanitizeEmailBodyHtml(bodyHtml);
  const safeCss = sanitizeCssForSrcdoc(extraCss);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${EMAIL_IFRAME_CSP}">
<base target="_blank" rel="noopener noreferrer">
<style>${EMAIL_DISPLAY_BASE_CSS}${safeCss ? `\n${safeCss}` : ""}</style>
</head>
<body>
<div class="email-message-root">
${safeBody}
</div>
</body>
</html>`;
}