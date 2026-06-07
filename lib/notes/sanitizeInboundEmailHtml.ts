import sanitizeHtml from "sanitize-html";
import juice from "juice";
import { EMAIL_PIPELINE_VERSION } from "@/lib/notes/emailPipeline";

const CSS_IMPORTANT = "(?:\\s*!important)?";

function cssLengthPattern(): RegExp {
  return new RegExp(`^-?\\d+(?:\\.\\d+)?(?:px|em|rem|%|pt)?${CSS_IMPORTANT}$`, "i");
}

function cssMultiLengthPattern(): RegExp {
  return new RegExp(
    `^-?(?:\\d+(?:\\.\\d+)?(?:px|em|rem|%|pt)?|auto)(?:\\s+-?(?:\\d+(?:\\.\\d+)?(?:px|em|rem|%|pt)?|auto)){0,3}${CSS_IMPORTANT}$`,
    "i",
  );
}

function cssLoosePattern(): RegExp {
  return new RegExp(`^[\\d\\s#a-z(),.%/!-]+${CSS_IMPORTANT}$`, "i");
}

/** CSS properties commonly used in transactional / marketing email layouts. */
const EMAIL_ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i, /^hsl\(/i, /^[a-z]+$/i],
    "background-color": [
      /^#[0-9a-f]{3,8}$/i,
      /^rgb\(/i,
      /^rgba\(/i,
      /^hsl\(/i,
      /^[a-z]+$/i,
      /^transparent$/i,
    ],
    background: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i, /^hsl\(/i, /^url\(/i, /^[a-z]+$/i],
    "background-image": [/^url\(/i, /^none$/i],
    "font-size": [cssLengthPattern(), /^\d+(?:\.\d+)?$/i],
    "font-family": [/^[\w\s,"'-]+$/i],
    "font-weight": [/^\d{3}$/i, /^normal$/i, /^bold$/i, /^bolder$/i, /^lighter$/i],
    "font-style": [/^normal$/i, /^italic$/i, /^oblique$/i],
    "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
    "text-decoration": [/^none$/i, /^underline$/i, /^line-through$/i, /^inherit$/i],
    "text-transform": [/^none$/i, /^uppercase$/i, /^lowercase$/i, /^capitalize$/i],
    "line-height": [cssLengthPattern(), /^\d+(?:\.\d+)?$/i],
    "letter-spacing": [cssLengthPattern()],
    padding: [cssMultiLengthPattern()],
    "padding-top": [cssLengthPattern()],
    "padding-right": [cssLengthPattern()],
    "padding-bottom": [cssLengthPattern()],
    "padding-left": [cssLengthPattern()],
    margin: [cssMultiLengthPattern()],
    "margin-top": [cssLengthPattern(), /^auto$/i],
    "margin-right": [cssLengthPattern(), /^auto$/i],
    "margin-bottom": [cssLengthPattern(), /^auto$/i],
    "margin-left": [cssLengthPattern(), /^auto$/i],
    border: [cssLoosePattern()],
    "border-top": [cssLoosePattern()],
    "border-right": [cssLoosePattern()],
    "border-bottom": [cssLoosePattern()],
    "border-left": [cssLoosePattern()],
    "border-collapse": [/^collapse$/i, /^separate$/i],
    "border-spacing": [cssLengthPattern(), cssMultiLengthPattern()],
    "border-radius": [cssMultiLengthPattern()],
    width: [cssLengthPattern(), /^auto$/i, /^100%$/i],
    height: [cssLengthPattern(), /^auto$/i],
    "max-width": [cssLengthPattern(), /^100%$/i],
    "min-width": [cssLengthPattern()],
    "max-height": [cssLengthPattern()],
    "min-height": [cssLengthPattern()],
    display: [
      /^block$/i,
      /^inline$/i,
      /^inline-block$/i,
      /^inline-flex$/i,
      /^table$/i,
      /^inline-table$/i,
      /^table-row$/i,
      /^table-cell$/i,
      /^table-row-group$/i,
      /^table-header-group$/i,
      /^table-footer-group$/i,
      /^none$/i,
      /^flex$/i,
    ],
    "table-layout": [/^auto$/i, /^fixed$/i],
    "vertical-align": [/^top$/i, /^middle$/i, /^bottom$/i, /^baseline$/i, /^text-top$/i, /^text-bottom$/i],
    "white-space": [/^normal$/i, /^nowrap$/i, /^pre$/i, /^pre-wrap$/i],
    float: [/^left$/i, /^right$/i, /^none$/i],
    "list-style-type": [/^disc$/i, /^circle$/i, /^square$/i, /^decimal$/i, /^none$/i],
    outline: [/^none$/i, cssLoosePattern()],
    "background-size": [cssLoosePattern(), /^cover$/i, /^contain$/i, /^auto$/i],
    "background-position": [cssLoosePattern()],
    "background-repeat": [/^repeat$/i, /^no-repeat$/i, /^repeat-x$/i, /^repeat-y$/i],
    "box-sizing": [/^border-box$/i, /^content-box$/i],
    "flex-direction": [/^row$/i, /^column$/i, /^row-reverse$/i, /^column-reverse$/i],
    "flex-wrap": [/^wrap$/i, /^nowrap$/i, /^wrap-reverse$/i],
    "align-items": [cssLoosePattern()],
    "align-self": [cssLoosePattern()],
    "justify-content": [cssLoosePattern()],
    "justify-self": [cssLoosePattern()],
    flex: [cssLoosePattern()],
    "flex-grow": [/^\d+$/],
    "flex-shrink": [/^\d+$/],
    "flex-basis": [cssLengthPattern(), /^auto$/i],
    gap: [cssLengthPattern(), cssMultiLengthPattern()],
    "row-gap": [cssLengthPattern()],
    "column-gap": [cssLengthPattern()],
    "object-fit": [/^contain$/i, /^cover$/i, /^fill$/i, /^none$/i, /^scale-down$/i],
    overflow: [/^visible$/i, /^hidden$/i, /^auto$/i, /^scroll$/i],
    "overflow-x": [/^visible$/i, /^hidden$/i, /^auto$/i, /^scroll$/i],
    "overflow-y": [/^visible$/i, /^hidden$/i, /^auto$/i, /^scroll$/i],
    position: [/^static$/i, /^relative$/i, /^absolute$/i, /^fixed$/i],
    top: [cssLengthPattern(), /^auto$/i, /^0$/i, /^0%$/i],
    right: [cssLengthPattern(), /^auto$/i, /^0$/i, /^0%$/i],
    bottom: [cssLengthPattern(), /^auto$/i, /^0$/i, /^0%$/i],
    left: [cssLengthPattern(), /^auto$/i, /^0$/i, /^0%$/i],
    "z-index": [/^\d+$/i, /^auto$/i],
    "-webkit-text-size-adjust": [/^100%$/i, /^none$/i],
    "mso-table-lspace": [cssLengthPattern(), /^0pt$/i],
    "mso-table-rspace": [cssLengthPattern(), /^0pt$/i],
    "mso-line-height-rule": [/^exactly$/i, /^at-least$/i],
    "mso-padding-alt": [cssMultiLengthPattern()],
    "mso-margin-top-alt": [cssLengthPattern(), /^auto$/i],
    "mso-margin-bottom-alt": [cssLengthPattern(), /^auto$/i],
    "mso-hide": [/^all$/i],
    "text-indent": [cssLengthPattern()],
    "word-break": [/^break-word$/i, /^normal$/i],
    "word-wrap": [/^break-word$/i, /^normal$/i],
    opacity: [/^\d*\.?\d+$/],
    visibility: [/^visible$/i, /^hidden$/i, /^collapse$/i],
    cursor: [/^pointer$/i, /^default$/i, /^auto$/i],
  },
};

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "div",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "sub",
    "sup",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "blockquote",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
    "center",
    "font",
    "hr",
    "pre",
    "abbr",
    "address",
    "small",
    "big",
    "wbr",
    "nobr",
    "section",
    "article",
    "header",
    "footer",
    "main",
    "label",
    "dl",
    "dt",
    "dd",
    "caption",
    "figure",
    "figcaption",
    "picture",
    "source",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel", "name", "style"],
    img: ["src", "alt", "title", "width", "height", "style", "border"],
    table: ["width", "height", "border", "cellpadding", "cellspacing", "align", "bgcolor", "role", "style"],
    thead: ["align", "style"],
    tbody: ["align", "style"],
    tfoot: ["align", "style"],
    tr: ["align", "valign", "bgcolor", "style"],
    th: ["align", "valign", "width", "height", "colspan", "rowspan", "bgcolor", "background", "style"],
    td: ["align", "valign", "width", "height", "colspan", "rowspan", "bgcolor", "background", "style"],
    col: ["span", "width", "style"],
    colgroup: ["span", "width", "style"],
    div: ["align", "style", "class", "id"],
    span: ["style", "class", "id"],
    p: ["align", "style"],
    font: ["color", "face", "size", "style"],
    center: ["style"],
    blockquote: ["style"],
    hr: ["width", "size", "align", "style"],
    abbr: ["title", "style"],
    address: ["style"],
    section: ["style", "class", "id"],
    article: ["style", "class", "id"],
    header: ["style", "class", "id"],
    footer: ["style", "class", "id"],
    main: ["style", "class", "id"],
    label: ["for", "style"],
    dl: ["style"],
    dt: ["style"],
    dd: ["style"],
    caption: ["align", "style"],
    figure: ["style", "class", "id"],
    figcaption: ["style"],
    picture: ["style"],
    source: ["srcset", "media", "type", "style"],
    "*": [
      "style",
      "class",
      "id",
      "align",
      "valign",
      "bgcolor",
      "width",
      "height",
      "border",
      "role",
      "dir",
      "lang",
      "title",
    ],
  },
  allowedSchemes: ["http", "https", "mailto", "data", "cid"],
  allowedStyles: EMAIL_ALLOWED_STYLES,
  transformTags: {
    b: "strong",
    i: "em",
    strike: "s",
  },
};

export type PreparedInboundEmailHtml = {
  html: string;
  css: string;
};

/** Expand Outlook MSO conditional blocks into real HTML before sanitization. */
export function expandMsoConditionalHtml(html: string): string {
  let result = html;
  result = result.replace(/<!--\[if\s+mso\][\s\S]*?<!\[endif\]-->/gi, (block) => {
    return block
      .replace(/<!--\[if\s+mso\]>/gi, "")
      .replace(/<!\[endif\]-->/gi, "")
      .trim();
  });
  result = result.replace(/<!--\[if\s+!mso\][\s\S]*?<!\[endif\]-->/gi, (block) => {
    return block
      .replace(/<!--\[if\s+!mso\]>/gi, "")
      .replace(/<!\[endif\]-->/gi, "")
      .trim();
  });
  return result;
}

/** Collect `<style>` blocks from the full MIME/HTML document (head + body). */
export function extractEmailStyleBlocks(html: string): string {
  const styles: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match = re.exec(html);
  while (match) {
    const block = match[1]?.trim();
    if (block) styles.push(block);
    match = re.exec(html);
  }
  return styles.join("\n");
}

/** Strip dangerous CSS while keeping email layout rules (classes, ids, tables). */
export function sanitizeEmailCss(css: string): string {
  if (!css.trim()) return "";

  return css
    .replace(/@import[^;]+;/gi, "")
    .replace(/@charset[^;]+;/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/behavior\s*:/gi, "")
    .replace(/-moz-binding/gi, "")
    .replace(/<\/style/gi, "")
    .trim();
}

/** Pull the renderable fragment from a full MIME/HTML document. */
export function extractEmailBodyFragment(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";

  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    return bodyMatch[1].replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").trim();
  }

  return trimmed
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .trim();
}

export function sanitizeInboundEmailHtml(html: string): string {
  const expanded = expandMsoConditionalHtml(html);
  const fragment = extractEmailBodyFragment(expanded);
  if (!fragment) return "";

  return sanitizeHtml(fragment, SANITIZE_OPTIONS).trim();
}

function normalizeCidKey(value: string): string {
  return value.replace(/^<|>$/g, "").trim().toLowerCase();
}

/** Replace cid: image sources (and table backgrounds) with stable attachment URLs. */
export function replaceCidSourcesInHtml(
  html: string,
  cidToUrl: Record<string, string>,
): string {
  if (!html || !Object.keys(cidToUrl).length) return html;

  const resolve = (cid: string): string | undefined => {
    const bare = cid.replace(/^cid:/i, "").trim();
    const key = normalizeCidKey(bare);
    return cidToUrl[key] ?? cidToUrl[bare] ?? cidToUrl[bare.toLowerCase()];
  };

  let result = html.replace(
    /\b(src|background|background-image)\s*=\s*["']cid:([^"']+)["']/gi,
    (match, attr, cid) => {
      const url = resolve(`cid:${cid}`);
      return url ? `${attr}="${url}"` : match;
    },
  );

  result = result.replace(/url\(\s*["']?cid:([^"')]+)["']?\s*\)/gi, (match, cid) => {
    const url = resolve(`cid:${cid}`);
    return url ? `url("${url}")` : match;
  });

  return result;
}

const EMAIL_IMAGE_OVERFLOW_GUARD = "max-width:100%;";

function appendOverflowGuardToStyle(style: string): string {
  const trimmed = style.trim().replace(/;+\s*$/, "");
  if (/max-width\s*:/i.test(trimmed)) return trimmed;
  return trimmed ? `${trimmed}; ${EMAIL_IMAGE_OVERFLOW_GUARD}` : EMAIL_IMAGE_OVERFLOW_GUARD;
}

function mergeImgStyleAttribute(attrs: string, styleValue: string): string {
  if (/\bstyle\s*=/i.test(attrs)) {
    return attrs.replace(
      /style\s*=\s*(["'])([\s\S]*?)\1/i,
      (_m, quote: string, style: string) => `style=${quote}${appendOverflowGuardToStyle(style)}${quote}`,
    );
  }
  const trimmed = attrs.trim();
  return trimmed ? `${trimmed} style="${styleValue}"` : `style="${styleValue}"`;
}

/**
 * Faithful image preservation: keep sender width/height attributes and inline sizes.
 * Fixes self-closing <img /> tags from sanitize-html (style was landing outside the tag).
 */
export function preserveEmailImagesFaithfully(html: string): string {
  return html.replace(/<img\b([\s\S]*?)\/?>/gi, (_tag, rawAttrs: string) => {
    const attrs = rawAttrs.trim().replace(/\s*\/\s*$/, "");
    const merged = mergeImgStyleAttribute(attrs, EMAIL_IMAGE_OVERFLOW_GUARD);
    return `<img ${merged}>`;
  });
}

/**
 * display:inline-block on table cells breaks column layouts — restore table-cell.
 */
export function normalizeTableCellDisplay(html: string): string {
  return html.replace(
    /<(td|th)(\s[^>]*?)style\s*=\s*(["'])([\s\S]*?)\3/gi,
    (_match, tag: string, before: string, quote: string, style: string) => {
      const fixed = style.replace(/display\s*:\s*inline-block/gi, "display:table-cell");
      return `<${tag}${before}style=${quote}${fixed}${quote}`;
    },
  );
}

export type InlineEmailStylesResult = {
  html: string;
  /** Non-empty when juice failed — pass to iframe srcdoc `<style>` instead of re-inlining at render. */
  cssFallback: string;
};

/** Inline extracted stylesheet rules into HTML attributes (juice / premailer pattern). */
export function inlineEmailStyles(html: string, extraCss: string): InlineEmailStylesResult {
  const body = html.trim();
  if (!body) return { html: "", cssFallback: "" };

  const css = extraCss.trim();
  if (!css) return { html: body, cssFallback: "" };

  const wrapped = `<!DOCTYPE html><html><head><style>${css}</style></head><body>${body}</body></html>`;

  try {
    const inlined = juice(wrapped, {
      applyStyleTags: true,
      removeStyleTags: true,
      preserveMediaQueries: true,
      preserveFontFaces: true,
      preserveImportant: true,
    });
    const bodyMatch = inlined.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return { html: bodyMatch?.[1]?.trim() ?? body, cssFallback: "" };
  } catch (err) {
    console.warn("[email-pipeline] juice inline failed; keeping external stylesheet fallback", err);
    return { html: body, cssFallback: css };
  }
}

/** @deprecated Use preserveEmailImagesFaithfully */
export const normalizeEmailImagesForDisplay = preserveEmailImagesFaithfully;

/**
 * Display-time pass only — does not re-run full ingest (no double juice on current pipeline).
 * Legacy notes (pipelineVersion < EMAIL_PIPELINE_VERSION or separate styles blob) may re-inline once.
 */
export function displayStoredEmailHtml(
  html: string,
  styles = "",
  pipelineVersion?: number,
): { html: string; extraCss: string } {
  if (!html.trim()) return { html: "", extraCss: "" };

  let result = normalizeTableCellDisplay(html);
  const css = sanitizeEmailCss(styles);
  const legacy = pipelineVersion == null || pipelineVersion < EMAIL_PIPELINE_VERSION;
  let extraCss = "";

  if (css) {
    if (legacy) {
      const inlined = inlineEmailStyles(result, css);
      result = inlined.html;
      extraCss = inlined.cssFallback;
    } else {
      extraCss = css;
    }
  }

  return { html: preserveEmailImagesFaithfully(result), extraCss };
}

/** @deprecated Use displayStoredEmailHtml — kept for callers during migration. */
export function reprocessStoredEmailHtml(html: string, styles = ""): string {
  return displayStoredEmailHtml(html, styles).html;
}

export function prepareInboundEmailHtml(
  html: string,
  cidToUrl?: Record<string, string>,
): PreparedInboundEmailHtml {
  const css = sanitizeEmailCss(extractEmailStyleBlocks(html));
  let sanitized = sanitizeInboundEmailHtml(html);
  if (!sanitized) {
    return { html: "", css };
  }

  sanitized = normalizeTableCellDisplay(sanitized);

  if (cidToUrl && Object.keys(cidToUrl).length) {
    sanitized = replaceCidSourcesInHtml(sanitized, cidToUrl);
  }

  const inlined = inlineEmailStyles(sanitized, css);
  sanitized = preserveEmailImagesFaithfully(inlined.html);

  return {
    html: sanitized,
    css: inlined.cssFallback,
  };
}