import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  cellAddress,
  colLetter,
  isSpreadsheetCellCovered,
  parseWorkbookSheets,
} from "@/lib/excel/spreadsheet";

describe("spreadsheet preview helpers", () => {
  it("encodes column letters and cell addresses", () => {
    expect(colLetter(0)).toBe("A");
    expect(colLetter(25)).toBe("Z");
    expect(colLetter(26)).toBe("AA");
    expect(cellAddress(0, 0)).toBe("A1");
    expect(cellAddress(2, 1, 4, 0)).toBe("B7");
  });

  it("parses workbook sheets with merges", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Name", "Qty"],
      ["Widget", 3],
    ]);
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Inventory");

    const sheets = parseWorkbookSheets(workbook);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("Inventory");
    expect(sheets[0].rows[0][0].display).toBe("Name");
    expect(isSpreadsheetCellCovered(0, 1, sheets[0].merges)).toBe(true);
  });
});