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
  compact?: boolean;
};

type CellPosition = { row: number; col: number };

function mergeAt(row: number, col: number, merges: SpreadsheetMerge[]): SpreadsheetMerge | undefined {
  return merges.find((m) => m.row === row && m.col === col);
}

export function ExcelPreview({ url, compact = false }: ExcelPreviewProps) {
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
        const response = await fetch(url, { credentials: "include" });
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
      <div
        className={cn(
          "flex h-full items-center justify-center text-text-muted",
          compact ? "min-h-[50dvh]" : "min-h-[280px]",
        )}
      >
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading spreadsheet…
      </div>
    );
  }

  if (error || !activeSheet) {
    return (
      <div
        className={cn(
          "excel-preview-empty-state flex h-full items-center justify-center p-8 text-center text-sm text-text-muted",
          compact ? "min-h-[50dvh]" : "min-h-[280px]",
        )}
      >
        {error ?? "Preview unavailable. Download the file instead."}
      </div>
    );
  }

  const colCount = activeSheet.rows[0]?.length ?? 0;

  return (
    <div className={cn("excel-preview flex h-full min-h-0 flex-col bg-[#f3f3f3]", compact && "excel-preview--compact")}>
      <div
        className={cn(
          "excel-preview-formula-bar flex shrink-0 items-center gap-2 border-b border-[#d4d4d4]",
          compact ? "px-2 py-1.5" : "px-3 py-2",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className={cn(
            "shrink-0 rounded border border-[#d4d4d4] bg-[#fafafa] text-center font-semibold text-[#217346]",
            compact ? "min-w-[44px] px-1.5 py-0.5 text-[10px]" : "min-w-[52px] px-2 py-1 text-xs",
          )}
        >
          {selectedAddress}
        </span>
        <div
          className={cn(
            "min-w-0 flex-1 truncate rounded border border-[#d4d4d4] bg-white text-[#18181b]",
            compact ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-sm",
          )}
        >
          {selectedCell?.display ?? ""}
        </div>
      </div>

      <div
        ref={gridRef}
        tabIndex={0}
        className={cn(
          "excel-preview-grid min-h-0 flex-1 overflow-auto outline-none",
          compact && sheets.length <= 1 && "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <table className="excel-preview-table border-collapse">
          <thead className={cn("sticky top-0", compact ? "z-[8]" : "z-20")}>
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
          className={cn(
            "excel-preview-tabs flex shrink-0 gap-0.5 overflow-x-auto border-t border-[#d4d4d4] bg-[#f3f3f3] touch-pan-x",
            compact
              ? "px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
              : "px-2 py-1",
          )}
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
                "shrink-0 rounded-t font-medium transition-colors touch-manipulation",
                compact ? "px-2.5 py-2 text-[11px]" : "px-3 py-1.5 text-xs",
                index === activeSheetIndex
                  ? "excel-preview-tab--active bg-white text-[#217346] shadow-sm"
                  : "text-text-faint hover:bg-white/70",
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