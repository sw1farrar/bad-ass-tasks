import { describe, expect, it } from "vitest";
import {
  appendAgendaEntryClipboardPlainText,
  buildAgendaEntryClipboardHtml,
} from "@/lib/meetings/agendaEntryLabels";

describe("agendaEntryLabels", () => {
  it("separates note body and timestamp in clipboard HTML", () => {
    const html = buildAgendaEntryClipboardHtml(
      "Need updated forecast",
      "2026-06-23T13:00:00Z",
      (text) => text,
    );
    expect(html).toContain("Need updated forecast</span><br />");
    expect(html).toContain("Jun 23, 2026</span>");
  });

  it("puts note body and date stamp on separate plain-text lines", () => {
    const lines: string[] = [];
    appendAgendaEntryClipboardPlainText(lines, "Need updated forecast", "2026-06-23T13:00:00Z");
    expect(lines[0]).toBe("   Need updated forecast");
    expect(lines[1]).toBe("   Jun 23, 2026");
  });
});