/** Minimum rendered height for inbound email iframes. */
export const EMAIL_IFRAME_MIN_HEIGHT_PX = 120;

/**
 * Sandboxed iframe permissions for inbound email HTML.
 * allow-same-origin: parent must read contentDocument to auto-size height.
 * allow-popups*: open links (base target=_blank) without enabling scripts.
 */
export const EMAIL_IFRAME_SANDBOX =
  "allow-same-origin allow-popups allow-popups-to-escape-sandbox";

/** Measure full email body height inside an iframe document. */
export function measureEmailIframeContentHeight(doc: Document): number {
  const body = doc.body;
  if (!body) return EMAIL_IFRAME_MIN_HEIGHT_PX;

  const root = (body.querySelector(".email-message-root") ?? body) as HTMLElement;
  const docEl = doc.documentElement;

  const contentHeight = Math.max(
    root.scrollHeight,
    root.offsetHeight,
    body.scrollHeight,
    body.offsetHeight,
    docEl.scrollHeight,
    docEl.offsetHeight,
  );

  return Math.max(EMAIL_IFRAME_MIN_HEIGHT_PX, Math.ceil(contentHeight + 8));
}