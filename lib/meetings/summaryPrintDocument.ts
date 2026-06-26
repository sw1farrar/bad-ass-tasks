import {
  LETTER_PAGE_HEIGHT_PT,
  LETTER_PAGE_WIDTH_PT,
  MEETING_AGENDA_PRINT_WIDTH_PX,
  MEETING_PRINT_LAYOUT_CSS,
  wrapMeetingPrintPage,
} from "@/lib/meetings/agendaPrintDocument";

export { LETTER_PAGE_HEIGHT_PT, LETTER_PAGE_WIDTH_PT, MEETING_AGENDA_PRINT_WIDTH_PX };

/** Compact black-and-white print/PDF styles for the meeting summary. */
export const MEETING_SUMMARY_PRINT_CSS = `
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
  .meeting-summary-doc {
    width: 100%;
    margin: 0;
    padding: 0;
    color: #000000;
  }
  .meeting-summary-doc__header {
    margin: 0 0 14px;
    padding: 0 0 10px;
    border-bottom: 1px solid #cccccc;
  }
  .meeting-summary-doc__eyebrow {
    margin: 0 0 4px;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #000000;
  }
  .meeting-summary-doc__title {
    margin: 0 0 10px;
    font-size: 14pt;
    font-weight: 700;
    line-height: 1.2;
    color: #000000;
  }
  .meeting-summary-doc__facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    margin: 0;
  }
  .meeting-summary-doc__fact {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .meeting-summary-doc__fact dt {
    margin: 0;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #000000;
  }
  .meeting-summary-doc__fact dd {
    margin: 0;
    font-size: 10pt;
    font-weight: 400;
    color: #000000;
  }
  .meeting-summary-doc__section {
    margin: 0 0 14px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .meeting-summary-doc__section-title {
    margin: 0 0 6px;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #000000;
  }
  .meeting-summary-doc__section--decisions {
    margin-bottom: 14px;
    padding: 8px 10px;
    border: 1px solid #cccccc;
  }
  .meeting-summary-doc__decision-list {
    margin: 0;
    padding: 0 0 0 14px;
  }
  .meeting-summary-doc__decision-list li {
    margin: 0 0 4px;
    font-size: 10pt;
    color: #000000;
  }
  .meeting-summary-doc__topic-list {
    margin: 0;
    padding: 0;
  }
  .meeting-summary-doc__topic {
    margin: 0 0 8px;
    padding: 8px 10px;
    border: 1px solid #cccccc;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .meeting-summary-doc__topic-head {
    margin: 0 0 4px;
  }
  .meeting-summary-doc__topic-title {
    margin: 0 0 2px;
    font-size: 11pt;
    font-weight: 700;
    color: #000000;
  }
  .meeting-summary-doc__topic-meta {
    font-size: 9pt;
    color: #000000;
  }
  .meeting-summary-doc__badge {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 8pt;
  }
  .meeting-summary-doc__owner::before {
    content: " · ";
  }
  .meeting-summary-doc__topic-context {
    margin: 0 0 6px;
    font-size: 9pt;
    color: #000000;
  }
  .meeting-summary-doc__notes {
    margin: 8px 0 0;
    padding: 0 0 0 14px;
    border-left: 2px solid #cccccc;
  }
  .meeting-summary-doc__note-date-section {
    margin: 0 0 10px 10px;
    padding: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .meeting-summary-doc__note-date-section:last-child {
    margin-bottom: 0;
  }
  .meeting-summary-doc__note-date-heading {
    margin: 0 0 4px;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #000000;
  }
  .meeting-summary-doc__note-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .meeting-summary-doc__note {
    margin: 0;
    padding: 0 0 6px;
    border-bottom: 1px solid #eeeeee;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .meeting-summary-doc__note:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
  .meeting-summary-doc__note-body {
    margin: 0;
    font-size: 9pt;
    color: #000000;
    white-space: pre-wrap;
  }
  .meeting-summary-doc__topic-empty {
    margin: 4px 0 0;
    font-size: 9pt;
    font-style: italic;
    color: #000000;
  }
  .meeting-summary-doc__section--followups {
    padding: 8px 10px;
    border: 1px solid #cccccc;
  }
  .meeting-summary-doc__followup-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .meeting-summary-doc__followup {
    margin: 0 0 4px;
    font-size: 10pt;
    color: #000000;
  }
  .meeting-summary-doc__followup-title {
    font-weight: 700;
  }
`;

function buildMeetingSummaryDocumentHtml(articleHtml: string, title: string): string {
  const safeTitle = title.replace(/[<>&"]/g, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} — Summary</title>
<style>${MEETING_SUMMARY_PRINT_CSS}${MEETING_PRINT_LAYOUT_CSS}</style>
</head>
<body>
${wrapMeetingPrintPage(articleHtml)}
</body>
</html>`;
}

export function buildMeetingSummaryPrintDocument(articleHtml: string, title: string): string {
  return buildMeetingSummaryDocumentHtml(articleHtml, title);
}

export function buildMeetingSummaryPreviewDocument(articleHtml: string, title: string): string {
  return buildMeetingSummaryPrintDocument(articleHtml, title);
}