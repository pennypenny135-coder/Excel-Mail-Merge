import type * as XLSXType from "xlsx";
import type { CellObject, WorkSheet } from "xlsx";
import type {
  ColumnType,
  ExcelCell,
  ExcelColumn,
  ExcelRow,
  LoadedWorkbook,
  ParsedSheet,
} from "@/types/excel";
import { formatDatePattern } from "@/lib/formatting";

export const MAX_ROWS = 1000;
export const TRUNCATE_WARNING = "Excel 資料超過 1,000 行，只會處理首 1,000 行。";

export class ExcelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcelError";
  }
}

let xlsxModule: typeof XLSXType | null = null;
async function getXlsx(): Promise<typeof XLSXType> {
  if (!xlsxModule) {
    const mod = (await import("xlsx")) as typeof XLSXType & { default?: typeof XLSXType };
    xlsxModule = mod.SSF ? mod : (mod.default as typeof XLSXType);
  }
  return xlsxModule;
}

export async function loadWorkbook(file: File): Promise<LoadedWorkbook> {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  if (ext !== "xlsx") {
    throw new ExcelError(
      `不支援「${ext ? "." + ext : "此"}」檔案格式。目前只支援 .xlsx。請用 Excel 開啟檔案後選擇「另存新檔 → Excel 活頁簿 (*.xlsx)」，再重新上載。（.xls、.xlsm、.csv 暫不支援）`,
    );
  }
  if (file.size === 0) {
    throw new ExcelError("檔案大小為 0 KB，沒有任何內容。請確認檔案已正確儲存後重新上載。");
  }
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 2));
  if (head[0] !== 0x50 || head[1] !== 0x4b) {
    throw new ExcelError(
      "檔案已損壞，或並非真正的 .xlsx 檔案（只是更改了副檔名）。請用 Excel 重新開啟並另存為 .xlsx 後再上載。",
    );
  }
  const XLSX = await getXlsx();
  let workbook: XLSXType.WorkBook;
  try {
    workbook = XLSX.read(buf, { type: "array", cellNF: true, cellText: true, cellDates: false });
  } catch {
    throw new ExcelError(
      "無法讀取此 Excel 檔案，檔案可能已損壞或受密碼保護。請用 Excel 開啟並另存為新的 .xlsx（不設密碼）後再上載。",
    );
  }
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new ExcelError("此 Excel 檔案沒有任何 worksheet。請確認檔案內容後重新上載。");
  }
  return { fileName: file.name, fileSize: file.size, sheetNames: workbook.SheetNames, workbook };
}

function isCurrencyFormat(z: string): boolean {
  return /[$€£¥￥]|\[\$/.test(z);
}

function toExcelCell(
  XLSX: typeof XLSXType,
  c: CellObject | undefined,
  is1904: boolean,
): ExcelCell {
  const blank: ExcelCell = { d: "", v: null, t: "blank", isDate: false };
  if (!c || c.t === "z" || c.v === undefined || c.v === null) return blank;
  if (c.t === "s" && String(c.v).trim() === "") return blank;
  const z = typeof c.z === "string" ? c.z : undefined;
  const isDate = c.t === "n" && !!z && z !== "General" && XLSX.SSF.is_date(z);
  let v = c.v as string | number | boolean;
  if (isDate && typeof v === "number" && is1904) v += 1462;
  let d: string;
  if (isDate && typeof v === "number" && z && (z === "m/d/yy" || z === "mm-dd-yy")) {
    // Excel 內建短日期格式會隨系統地區而變，香港地區顯示為 DD/MM/YYYY
    d = formatDatePattern(v, "DD/MM/YYYY");
  } else if (typeof c.w === "string" && c.w !== "") {
    d = c.w;
  } else {
    try {
      d = XLSX.utils.format_cell(c);
    } catch {
      d = String(c.v);
    }
    if (!d) d = String(c.v);
  }
  const t = c.t === "n" || c.t === "s" || c.t === "b" || c.t === "e" ? c.t : "s";
  return { d, v, t, z, isDate };
}

function inferType(cells: ExcelCell[]): ColumnType {
  const nonEmpty = cells.filter((c) => c.t !== "blank");
  if (nonEmpty.length === 0) return "empty";
  const counts: Record<string, number> = {};
  for (const c of nonEmpty) {
    let k = "text";
    if (c.isDate) k = "date";
    else if (c.t === "n") {
      if (c.z && c.z.includes("%")) k = "percentage";
      else if (c.z && isCurrencyFormat(c.z)) k = "currency";
      else k = "number";
    }
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (top !== "text" && n / nonEmpty.length >= 0.6) return top as ColumnType;
  return "text";
}

function getRowCells(
  XLSX: typeof XLSXType,
  ws: WorkSheet,
  r: number,
  c0: number,
  c1: number,
  is1904: boolean,
): ExcelCell[] {
  const out: ExcelCell[] = [];
  for (let c = c0; c <= c1; c++) {
    out.push(toExcelCell(XLSX, ws[XLSX.utils.encode_cell({ r, c })] as CellObject | undefined, is1904));
  }
  return out;
}

/** 自動偵測 header row（1-based）：預設第 1 行，除非第 1 行明顯不是標題 */
export async function detectHeaderRow(wb: LoadedWorkbook, sheetName: string): Promise<number> {
  const XLSX = await getXlsx();
  const ws = wb.workbook.Sheets[sheetName];
  if (!ws || !ws["!ref"]) return 1;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const last = Math.min(range.e.r, range.s.r + 14);
  const stats: { nonEmpty: number; strings: number }[] = [];
  for (let r = range.s.r; r <= last; r++) {
    const cells = getRowCells(XLSX, ws, r, range.s.c, range.e.c, false);
    const ne = cells.filter((c) => c.t !== "blank");
    stats.push({ nonEmpty: ne.length, strings: ne.filter((c) => c.t === "s").length });
  }
  const max = Math.max(...stats.map((s) => s.nonEmpty), 0);
  if (max === 0) return 1;
  const need = Math.max(1, Math.ceil(max * 0.6));
  const first = stats[0];
  if (first && first.nonEmpty >= need && first.strings / first.nonEmpty >= 0.8) return 1;
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    if (s.nonEmpty >= Math.max(2, need) && s.strings / s.nonEmpty >= 0.8) return range.s.r + i + 1;
  }
  return 1;
}

export async function parseSheet(
  wb: LoadedWorkbook,
  sheetName: string,
  headerRow: number,
): Promise<ParsedSheet> {
  if (!sheetName) {
    throw new ExcelError("尚未選擇 worksheet。請在「Sheet」下拉選單中選擇要使用的工作表。");
  }
  const XLSX = await getXlsx();
  const ws = wb.workbook.Sheets[sheetName];
  if (!ws) throw new ExcelError(`找不到工作表「${sheetName}」。請重新選擇 Sheet。`);
  const ref = ws["!ref"];
  if (!ref) {
    throw new ExcelError(`工作表「${sheetName}」沒有任何資料。請選擇其他 Sheet，或確認 Excel 內有資料後重新上載。`);
  }
  const range = XLSX.utils.decode_range(ref);
  const is1904 = !!(wb.workbook.Workbook?.WBProps as { date1904?: boolean } | undefined)?.date1904;
  const lastRowNumber = range.e.r + 1;
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > lastRowNumber) {
    throw new ExcelError(
      `標題行（Header row）第 ${headerRow} 行超出資料範圍（此 Sheet 只有 ${lastRowNumber} 行）。請輸入 1 至 ${lastRowNumber} 之間的數字。`,
    );
  }
  const headerCells = getRowCells(XLSX, ws, headerRow - 1, range.s.c, range.e.c, is1904);
  if (headerCells.every((c) => c.t === "blank")) {
    throw new ExcelError(
      `第 ${headerRow} 行沒有任何標題（Header）。請在「標題行」輸入正確的行號，或在 Excel 第一行加入欄位名稱後重新上載。`,
    );
  }

  const rows: ExcelRow[] = [];
  let truncated = false;
  const scanLimit = Math.min(range.e.r, headerRow - 1 + 200000);
  for (let r = headerRow; r <= scanLimit; r++) {
    const cells = getRowCells(XLSX, ws, r, range.s.c, range.e.c, is1904);
    if (cells.every((c) => c.t === "blank")) continue;
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      break;
    }
    rows.push({ rowNumber: r + 1, cells });
  }
  if (rows.length === 0) {
    throw new ExcelError(
      `工作表「${sheetName}」在標題行（第 ${headerRow} 行）之後沒有資料。請確認標題行是否正確，或選擇其他 Sheet。`,
    );
  }

  // 決定要保留的欄（略過標題及資料皆空白的欄）
  const keep: number[] = [];
  headerCells.forEach((h, i) => {
    if (h.t !== "blank" || rows.some((row) => row.cells[i].t !== "blank")) keep.push(i);
  });

  const baseHeaders = keep.map((i) => {
    const h = headerCells[i];
    return h.t === "blank" ? "" : h.d.trim();
  });
  const letters = keep.map((i) => XLSX.utils.encode_col(range.s.c + i));
  const counts = new Map<string, number>();
  baseHeaders.forEach((h, k) => {
    const name = h || `欄位 ${letters[k]}`;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });

  const columns: ExcelColumn[] = keep.map((i, k) => {
    const name = baseHeaders[k] || `欄位 ${letters[k]}`;
    const header = (counts.get(name) ?? 0) > 1 ? `${name} (${letters[k]})` : name;
    const colCells = rows.map((row) => row.cells[i]);
    const nonEmpty = colCells.filter((c) => c.t !== "blank");
    return {
      index: k,
      letter: letters[k],
      header,
      originalHeader: name,
      type: inferType(colCells),
      samples: nonEmpty.slice(0, 5).map((c) => c.d),
      nonEmptyCount: nonEmpty.length,
    };
  });

  const trimmedRows: ExcelRow[] = rows.map((row) => ({
    rowNumber: row.rowNumber,
    cells: keep.map((i) => row.cells[i]),
  }));

  return { sheetName, headerRow, columns, rows: trimmedRows, truncated };
}
