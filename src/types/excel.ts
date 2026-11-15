import type { WorkBook } from "xlsx";

export type ColumnType = "text" | "number" | "currency" | "percentage" | "date" | "empty";

/** 單一 Excel 儲存格（只保留 merge 所需資料） */
export interface ExcelCell {
  /** Excel 顯示值（formatted display value） */
  d: string;
  /** 原始值；日期以 Excel serial（1900 系統）表示 */
  v: string | number | boolean | null;
  t: "n" | "s" | "b" | "e" | "blank";
  /** Excel number format */
  z?: string;
  isDate: boolean;
}

export interface ExcelColumn {
  index: number;
  letter: string;
  header: string;
  originalHeader: string;
  type: ColumnType;
  samples: string[];
  nonEmptyCount: number;
}

export interface ExcelRow {
  /** Excel 實際行號（1-based） */
  rowNumber: number;
  cells: ExcelCell[];
}

export interface ParsedSheet {
  sheetName: string;
  headerRow: number;
  columns: ExcelColumn[];
  rows: ExcelRow[];
  truncated: boolean;
}

export interface LoadedWorkbook {
  fileName: string;
  fileSize: number;
  sheetNames: string[];
  workbook: WorkBook;
}
