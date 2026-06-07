import * as XLSX from "xlsx";
import type { CellObject, ColInfo, Range, WorkBook, WorkSheet } from "xlsx";

export type SpreadsheetCellStyle = {
  bold?: boolean;
  italic?: boolean;
  bg?: string;
  color?: string;
  align?: "left" | "center" | "right";
};

export type SpreadsheetCell = {
  value: string;
  display: string;
  style?: SpreadsheetCellStyle;
};

export type SpreadsheetMerge = {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
};

export type SpreadsheetSheet = {
  name: string;
  rows: SpreadsheetCell[][];
  colWidths: number[];
  merges: SpreadsheetMerge[];
  startRow: number;
  startCol: number;
};

const DEFAULT_COL_WIDTH = 88;
const MIN_COL_WIDTH = 48;
const MAX_COL_WIDTH = 280;

function colLetter(col: number): string {
  let label = "";
  let n = col;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export function cellAddress(row: number, col: number, startRow = 0, startCol = 0): string {
  return `${colLetter(col + startCol)}${row + startRow + 1}`;
}

function parseCellStyle(cell?: CellObject): SpreadsheetCellStyle | undefined {
  if (!cell?.s || typeof cell.s !== "object") return undefined;
  const style = cell.s as {
    font?: { bold?: boolean; italic?: boolean; color?: { rgb?: string } };
    fill?: { fgColor?: { rgb?: string } };
    alignment?: { horizontal?: string };
  };

  const bg = style.fill?.fgColor?.rgb;
  const color = style.font?.color?.rgb;
  const align = style.alignment?.horizontal;

  const parsed: SpreadsheetCellStyle = {};
  if (style.font?.bold) parsed.bold = true;
  if (style.font?.italic) parsed.italic = true;
  if (bg) parsed.bg = `#${bg.replace(/^#/, "").slice(-6)}`;
  if (color) parsed.color = `#${color.replace(/^#/, "").slice(-6)}`;
  if (align === "center" || align === "right" || align === "left") parsed.align = align;

  return Object.keys(parsed).length ? parsed : undefined;
}

function parseColWidths(cols: ColInfo[] | undefined, count: number): number[] {
  const widths: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const info = cols?.[i];
    const px =
      info?.wpx ??
      (info?.width != null ? Math.round(info.width * 7 + 5) : DEFAULT_COL_WIDTH);
    widths.push(Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, px)));
  }
  return widths;
}

function parseMerges(range: Range, merges: Range[] | undefined): SpreadsheetMerge[] {
  if (!merges?.length) return [];
  return merges.map((merge) => ({
    row: merge.s.r - range.s.r,
    col: merge.s.c - range.s.c,
    rowSpan: merge.e.r - merge.s.r + 1,
    colSpan: merge.e.c - merge.s.c + 1,
  }));
}

function isMergeCovered(
  row: number,
  col: number,
  merges: SpreadsheetMerge[],
): SpreadsheetMerge | null {
  for (const merge of merges) {
    if (
      row >= merge.row &&
      col >= merge.col &&
      row < merge.row + merge.rowSpan &&
      col < merge.col + merge.colSpan
    ) {
      if (row !== merge.row || col !== merge.col) return merge;
      return null;
    }
  }
  return null;
}

export function isSpreadsheetCellCovered(
  row: number,
  col: number,
  merges: SpreadsheetMerge[],
): boolean {
  return isMergeCovered(row, col, merges) !== null;
}

export function parseWorkbookSheets(workbook: WorkBook): SpreadsheetSheet[] {
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    return parseSheet(sheet, name);
  }).filter((sheet) => sheet.rows.length > 0);
}

export function parseSheet(sheet: WorkSheet, name: string): SpreadsheetSheet {
  const ref = sheet["!ref"];
  if (!ref) {
    return { name, rows: [], colWidths: [], merges: [], startRow: 0, startCol: 0 };
  }

  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;
  const merges = parseMerges(range, sheet["!merges"]);
  const rows: SpreadsheetCell[][] = [];

  for (let r = 0; r < rowCount; r += 1) {
    const row: SpreadsheetCell[] = [];
    for (let c = 0; c < colCount; c += 1) {
      if (isSpreadsheetCellCovered(r, c, merges)) {
        row.push({ value: "", display: "" });
        continue;
      }

      const addr = XLSX.utils.encode_cell({ r: range.s.r + r, c: range.s.c + c });
      const cell = sheet[addr] as CellObject | undefined;
      const display =
        cell?.w ??
        (cell?.v == null
          ? ""
          : typeof cell.v === "number"
            ? String(cell.v)
            : String(cell.v));

      row.push({
        value: cell?.v == null ? "" : String(cell.v),
        display,
        style: parseCellStyle(cell),
      });
    }
    rows.push(row);
  }

  return {
    name,
    rows,
    colWidths: parseColWidths(sheet["!cols"], colCount),
    merges,
    startRow: range.s.r,
    startCol: range.s.c,
  };
}

export { colLetter };