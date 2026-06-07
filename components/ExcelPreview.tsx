"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  cellAddress,
  colLetter,
  isSpreadsheetCellCovered,
  parseWorkbookSheets,
  type SpreadsheetMerge,
  type SpreadsheetSheet,
} from "@/lib/excel/spreadsheet";
import { cn } from "@/lib/utils";

type ExcelPreviewProps = {
  url: string;
};

type CellPosition = { row: number; col: number };

function mergeAt(row: number, col: number, merges: SpreadsheetMerge[]): SpreadsheetMerge | undefined {
  return merges.find((m) => m.row === row && m.col === col);
}

export function ExcelPreview({ url }: ExcelPreviewProps) {
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<CellPosition>({ row: 0, col: 0 });
  const gridRef = useRef<HTMLDivElement>(null);
  const selectedCellRef = useRef<HTMLTableCellElement | null>(null);

  const activeSheet = sheets[activeSheetIndex] ?? null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSheets([]);
      setActiveSheetIndex(0);
      setSelection({ row: 0, col: 0 });

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("fetch_failed");
        const buffer = await response.arrayBuffer();
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "array", cellStyles: true });
        const parsed = parseWorkbookSheets(workbook);
        if (!parsed.length) throw new Error("no_sheet");
        if (!cancelled) setSheets(parsed);
      } catch {
        if (!cancelled) setError("Preview unavailable. Download the file instead.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const selectedCell = useMemo(() => {
    if (!activeSheet) return null;
    const row = activeSheet.rows[selection.row];
    if (!row) return null;
    return row[selection.col] ?? null;
  }, [activeSheet, selection]);

  const selectedAddress = useMemo(() => {
    if (!activeSheet) return "A1";
    return cellAddress(selection.row, selection.col, activeSheet.startRow, activeSheet.startCol);
  }, [activeSheet, selection]);

  const moveSelection = useCallback(
    (deltaRow: number, deltaCol: number) => {
      if (!activeSheet) return;
      const maxRow = activeSheet.rows.length - 1;
      const maxCol = (activeSheet.rows[0]?.length ?? 1) - 1;

      setSelection((prev) => {
        let nextRow = prev.row + deltaRow;
        let nextCol = prev.col + deltaCol;

        nextRow = Math.max(0, Math.min(maxRow, nextRow));
        nextCol = Math.max(0, Math.min(maxCol, nextCol));

        while (
          isSpreadsheetCellCovered(nextRow, nextCol, activeSheet.merges) &&
          (nextRow !== prev.row || nextCol !== prev.col)
        ) {
          nextRow += deltaRow;
          nextCol += deltaCol;
          nextRow = Math.max(0, Math.min(maxRow, nextRow));
          nextCol = Math.max(0, Math.min(maxCol, nextCol));
        }

        return { row: nextRow, col: nextCol };
      });
    },
    [activeSheet],
  );

  useEffect(() => {
    selectedCellRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selection, activeSheetIndex]);

  useEffect(() => {
    if (!loading && activeSheet) {
      gridRef.current?.focus({ preventScroll: true });
    }
  }, [loading, activeSheet, activeSheetIndex]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          moveSelection(-1, 0);
          break;
        case "ArrowDown":
          event.preventDefault();
          moveSelection(1, 0);
          break;
        case "ArrowLeft":
          event.preventDefault();
          moveSelection(0, -1);
          break;
        case "ArrowRight":
        case "Tab":
          event.preventDefault();
          moveSelection(0, 1);
          break;
        case "Enter":
          event.preventDefault();
          moveSelection(1, 0);
          break;
        default:
          break;
      }
    };

    grid.addEventListener("keydown", handleKeyDown);
    return () => grid.removeEventListener("keydown", handleKeyDown);
  }, [moveSelection]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-[#71717a]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading spreadsheet…
      </div>
    );
  }

  if (error || !activeSheet) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center bg-white p-8 text-center text-sm text-[#71717a]">
        {error ?? "Preview unavailable. Download the file instead."}
      </div>
    );
  }

  const colCount = activeSheet.rows[0]?.length ?? 0;

  return (
    <div className="excel-preview flex h-full min-h-0 flex-col bg-[#f3f3f3]">
      <div
        className="flex shrink-0 items-center gap-2 border-b border-[#d4d4d4] bg-white px-3 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-[52px] rounded border border-[#d4d4d4] bg-[#fafafa] px-2 py-1 text-center text-xs font-semibold text-[#217346]">
          {selectedAddress}
        </span>
        <div className="min-w-0 flex-1 truncate rounded border border-[#d4d4d4] bg-white px-2 py-1 text-sm text-[#18181b]">
          {selectedCell?.display ?? ""}
        </div>
      </div>

      <div
        ref={gridRef}
        tabIndex={0}
        className="excel-preview-grid min-h-0 flex-1 overflow-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <table className="excel-preview-table border-collapse">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="excel-preview-corner" />
              {Array.from({ length: colCount }, (_, col) => (
                <th
                  key={`col-${col}`}
                  className="excel-preview-col-header"
                  style={{ width: activeSheet.colWidths[col] ?? 88, minWidth: activeSheet.colWidths[col] ?? 88 }}
                >
                  {colLetter(col + activeSheet.startCol)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSheet.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                <th className="excel-preview-row-header sticky left-0 z-10">
                  {rowIndex + activeSheet.startRow + 1}
                </th>
                {row.map((cell, colIndex) => {
                  if (isSpreadsheetCellCovered(rowIndex, colIndex, activeSheet.merges)) {
                    return null;
                  }

                  const merge = mergeAt(rowIndex, colIndex, activeSheet.merges);
                  const isSelected = selection.row === rowIndex && selection.col === colIndex;

                  return (
                    <td
                      key={`cell-${rowIndex}-${colIndex}`}
                      ref={isSelected ? selectedCellRef : undefined}
                      rowSpan={merge?.rowSpan}
                      colSpan={merge?.colSpan}
                      className={cn("excel-preview-cell", isSelected && "excel-preview-cell--selected")}
                      style={{
                        width: activeSheet.colWidths[colIndex] ?? 88,
                        minWidth: activeSheet.colWidths[colIndex] ?? 88,
                        backgroundColor: cell.style?.bg,
                        color: cell.style?.color,
                        fontWeight: cell.style?.bold ? 600 : undefined,
                        fontStyle: cell.style?.italic ? "italic" : undefined,
                        textAlign: cell.style?.align,
                      }}
                      onClick={() => setSelection({ row: rowIndex, col: colIndex })}
                    >
                      {cell.display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sheets.length > 1 && (
        <div
          className="flex shrink-0 gap-0.5 overflow-x-auto border-t border-[#d4d4d4] bg-[#f3f3f3] px-2 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              type="button"
              onClick={() => {
                setActiveSheetIndex(index);
                setSelection({ row: 0, col: 0 });
              }}
              className={cn(
                "rounded-t px-3 py-1.5 text-xs font-medium transition-colors",
                index === activeSheetIndex
                  ? "bg-white text-[#217346] shadow-sm"
                  : "text-[#52525b] hover:bg-white/70",
              )}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}