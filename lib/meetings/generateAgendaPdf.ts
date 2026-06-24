import {
  buildMeetingAgendaPrintDocument,
  LETTER_PAGE_HEIGHT_PT,
  LETTER_PAGE_WIDTH_PT,
  MEETING_AGENDA_PRINT_WIDTH_PX,
  MEETING_PRINT_PAGE_CLASS,
} from "@/lib/meetings/agendaPrintDocument";

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function mountAgendaPrintFrame(
  articleHtml: string,
  title: string,
  buildPrintDocument: (html: string, title: string) => string,
): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.setAttribute("data-meeting-agenda-pdf-frame", "true");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${MEETING_AGENDA_PRINT_WIDTH_PX}px`,
    "border:0",
    "opacity:0",
    "pointer-events:none",
    "overflow:hidden",
    "z-index:-1",
  ].join(";");

  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) throw new Error("Could not initialize agenda print frame");

  doc.open();
  doc.write(buildPrintDocument(articleHtml, title));
  doc.close();

  return frame;
}

async function waitForFrameReady(frame: HTMLIFrameElement): Promise<HTMLElement> {
  await new Promise<void>((resolve) => {
    if (frame.contentDocument?.readyState === "complete") {
      resolve();
      return;
    }
    frame.addEventListener("load", () => resolve(), { once: true });
    window.setTimeout(resolve, 250);
  });
  await waitForPaint();

  const doc = frame.contentDocument;
  if (!doc?.body) throw new Error("Agenda print frame did not load");

  const page = doc.querySelector(`.${MEETING_PRINT_PAGE_CLASS}`);
  return (page as HTMLElement | null) ?? doc.body;
}

function imageHeightPt(canvas: HTMLCanvasElement): number {
  return (canvas.height * LETTER_PAGE_WIDTH_PT) / canvas.width;
}

type JsPdfCtor = typeof import("jspdf").jsPDF;

function addCanvasToPdf(
  canvas: HTMLCanvasElement,
  jsPDF: JsPdfCtor,
): InstanceType<JsPdfCtor> {
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const imgWidthPt = LETTER_PAGE_WIDTH_PT;
  const imgHeightPt = imageHeightPt(canvas);

  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });

  if (imgHeightPt <= LETTER_PAGE_HEIGHT_PT) {
    doc.addImage(imgData, "JPEG", 0, 0, imgWidthPt, imgHeightPt);
    return doc;
  }
  let offset = 0;
  let page = 0;
  while (offset < imgHeightPt - 0.5) {
    if (page > 0) doc.addPage();
    doc.addImage(imgData, "JPEG", 0, -offset, imgWidthPt, imgHeightPt);
    offset += LETTER_PAGE_HEIGHT_PT;
    page += 1;
  }
  return doc;
}

/** Render meeting document HTML to a PDF blob (browser only). */
export async function generateMeetingAgendaPdf(
  articleHtml: string,
  title = "Meeting agenda",
  buildPrintDocument: (html: string, title: string) => string = buildMeetingAgendaPrintDocument,
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("PDF generation requires a browser environment");
  }

  const frame = mountAgendaPrintFrame(articleHtml, title, buildPrintDocument);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const captureTarget = await waitForFrameReady(frame);
    const contentHeight = Math.max(1, Math.ceil(captureTarget.scrollHeight));
    captureTarget.style.width = `${MEETING_AGENDA_PRINT_WIDTH_PX}px`;
    frame.style.height = `${contentHeight}px`;
    await waitForPaint();

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(captureTarget, {
      scale: 1,
      width: MEETING_AGENDA_PRINT_WIDTH_PX,
      height: contentHeight,
      windowWidth: MEETING_AGENDA_PRINT_WIDTH_PX,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("Agenda canvas was empty");
    }

    const { jsPDF } = await import("jspdf");
    const doc = addCanvasToPdf(canvas, jsPDF);

    const blob = doc.output("blob");
    if (!blob || blob.size < 128) {
      throw new Error("Generated PDF was empty");
    }
    return blob;
  } finally {
    frame.remove();
  }
}

export function printMeetingAgendaPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.src = url;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 1500);
  };
}