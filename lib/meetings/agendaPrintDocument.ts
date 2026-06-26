/** Compact black-and-white print/PDF styles for the meeting agenda. */
export const MEETING_AGENDA_PRINT_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
    font-family: Calibri, "Segoe UI", Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .meeting-agenda-doc {
    width: 100%;
    margin: 0;
    padding: 0;
    color: #000000;
  }
  .meeting-agenda-doc__title {
    margin: 0 0 2px;
    font-size: 14pt;
    font-weight: 700;
    line-height: 1.2;
    color: #000000;
  }
  .meeting-agenda-doc__date {
    margin: 0 0 10px;
    font-size: 10pt;
    color: #000000;
  }
  .meeting-agenda-doc__label {
    margin: 0 0 6px;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #000000;
  }
  .meeting-agenda-doc__empty {
    margin: 0;
    font-size: 10pt;
    color: #000000;
  }
  .meeting-agenda-doc__list {
    margin: 0;
    padding-left: 18px;
  }
  .meeting-agenda-doc__item {
    margin: 0 0 5px;
    padding: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .meeting-agenda-doc__item-title {
    font-weight: 700;
    color: #000000;
  }
  .meeting-agenda-doc__item-meta {
    font-weight: 400;
    color: #000000;
  }
  .meeting-agenda-doc__item-desc {
    margin: 1px 0 0;
    font-size: 9pt;
    color: #000000;
  }
  .meeting-agenda-doc__comments {
    margin: 8px 0 0;
    padding: 0 0 0 14px;
    border-left: 2px solid #cccccc;
  }
  .meeting-agenda-doc__comment-date-section {
    margin: 0 0 10px 10px;
    padding: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .meeting-agenda-doc__comment-date-section:last-child {
    margin-bottom: 0;
  }
  .meeting-agenda-doc__comment-date-heading {
    margin: 0 0 4px;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #000000;
  }
  .meeting-agenda-doc__comment-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .meeting-agenda-doc__comment {
    margin: 0;
    padding: 0 0 6px;
    border-bottom: 1px solid #eeeeee;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .meeting-agenda-doc__comment:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
  .meeting-agenda-doc__comment-body {
    margin: 0;
    font-size: 9pt;
    color: #000000;
    white-space: pre-wrap;
  }
`;

/** US Letter width in PDF points (8.5in × 72). */
export const LETTER_PAGE_WIDTH_PT = 612;

/** US Letter height in PDF points (11in × 72). */
export const LETTER_PAGE_HEIGHT_PT = 792;

/** Render/capture width in CSS pixels at 96dpi — matches letter page width. */
export const MEETING_AGENDA_PRINT_WIDTH_PX = Math.round(LETTER_PAGE_WIDTH_PT * (96 / 72));

/** Inner page surface captured for PDF generation. */
export const MEETING_PRINT_PAGE_CLASS = "meeting-print-page";

export const MEETING_PRINT_LAYOUT_CSS = `
  html, body {
    margin: 0;
    padding: 0;
    width: ${MEETING_AGENDA_PRINT_WIDTH_PX}px;
    min-height: 100%;
    background: #ffffff;
  }
  .${MEETING_PRINT_PAGE_CLASS} {
    width: ${MEETING_AGENDA_PRINT_WIDTH_PX}px;
    margin: 0;
    padding: 32px 40px;
    box-sizing: border-box;
    background: #ffffff;
  }
`;

export function wrapMeetingPrintPage(articleHtml: string): string {
  return `<div class="${MEETING_PRINT_PAGE_CLASS}">${articleHtml}</div>`;
}

function buildMeetingAgendaDocumentHtml(articleHtml: string, title: string): string {
  const safeTitle = title.replace(/[<>&"]/g, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} — Agenda</title>
<style>${MEETING_AGENDA_PRINT_CSS}${MEETING_PRINT_LAYOUT_CSS}</style>
</head>
<body>
${wrapMeetingPrintPage(articleHtml)}
</body>
</html>`;
}

/** Print/PDF document and on-screen PDF preview share the same layout. */
export function buildMeetingAgendaPrintDocument(articleHtml: string, title: string): string {
  return buildMeetingAgendaDocumentHtml(articleHtml, title);
}

/** Alias — preview and downloaded PDF use identical markup. */
export function buildMeetingAgendaPreviewDocument(articleHtml: string, title: string): string {
  return buildMeetingAgendaPrintDocument(articleHtml, title);
}