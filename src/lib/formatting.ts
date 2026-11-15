import type { ExcelCell, ColumnType } from "@/types/excel";
import type { BlankMode, OutputFormat, PlaceholderSetting } from "@/types/template";

export const DEFAULT_PLACEHOLDER_SETTING: PlaceholderSetting = {
  format: "excel",
  blank: "default",
};

export const OUTPUT_FORMAT_LABELS: Record<OutputFormat, string> = {
  excel: "跟隨 Excel 格式 / Follow Excel format",
  text: "純文字 / Plain text",
  number: "數字 / Number",
  currency: "貨幣 / Currency",
  percentage: "百分比 / Percentage",
  date: "日期 / Date (DD/MM/YYYY)",
  customDate: "自訂日期格式 / Custom date format",
};

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: "Text",
  number: "Number",
  currency: "Currency",
  percentage: "Percentage",
  date: "Date",
  empty: "Empty",
};

export interface FormatOutcome {
  text: string;
  blank: boolean;
  skip: boolean;
  issue?: "nan" | "baddate";
}

export interface BlankDefault {
  mode: BlankMode;
  text: string;
}

const pad = (n: number, len = 2) => String(n).padStart(len, "0");

export interface DateParts {
  y: number;
  m: number;
  d: number;
  H: number;
  M: number;
  S: number;
}

/** Excel serial（1900 系統）→ 日期部份 */
export function serialToParts(serial: number): DateParts | null {
  if (!Number.isFinite(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return null;
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
    H: dt.getUTCHours(),
    M: dt.getUTCMinutes(),
    S: dt.getUTCSeconds(),
  };
}

export function partsToSerial(y: number, m: number, d: number): number | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return ms / 86400000 + 25569;
}

/** 以 DD/MM/YYYY、YYYY-MM-DD 等 token 格式化日期 */
export function formatDatePattern(serial: number, pattern: string): string {
  const p = serialToParts(serial);
  if (!p) return "";
  return pattern.replace(/YYYY|YY|MM|M|DD|D|HH|mm|ss/g, (tok) => {
    switch (tok) {
      case "YYYY":
        return pad(p.y, 4);
      case "YY":
        return pad(p.y % 100);
      case "MM":
        return pad(p.m);
      case "M":
        return String(p.m);
      case "DD":
        return pad(p.d);
      case "D":
        return String(p.d);
      case "HH":
        return pad(p.H);
      case "mm":
        return pad(p.M);
      case "ss":
        return pad(p.S);
      default:
        return tok;
    }
  });
}

const CURRENCY_STRIP = /(HKD|USD|CNY|RMB|NT\$|HK\$|US\$|NT|HK|US|[$€£¥￥])/gi;

/** 嘗試將儲存格轉為數字；percent 表示字串帶 % */
export function toNumber(cell: ExcelCell): number | null {
  if (cell.t === "n" && typeof cell.v === "number") return cell.v;
  if (cell.t === "s" && typeof cell.v === "string") {
    let s = cell.v.trim();
    let neg = false;
    if (/^\(.*\)$/.test(s)) {
      neg = true;
      s = s.slice(1, -1);
    }
    const pct = s.endsWith("%");
    s = s.replace(CURRENCY_STRIP, "").replace(/[%,\s]/g, "");
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    let n = Number(s);
    if (!Number.isFinite(n)) return null;
    if (pct) n /= 100;
    return neg ? -n : n;
  }
  return null;
}

/** 嘗試將儲存格轉為 Excel serial 日期 */
export function toSerial(cell: ExcelCell): number | null {
  if (cell.isDate && typeof cell.v === "number") return cell.v;
  if (cell.t === "s" && typeof cell.v === "string") {
    const s = cell.v.trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m) {
      const base = partsToSerial(Number(m[1]), Number(m[2]), Number(m[3]));
      if (base === null) return null;
      return base + (m[4] ? (Number(m[4]) * 60 + Number(m[5])) / 1440 : 0);
    }
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) return partsToSerial(Number(m[3]), Number(m[2]), Number(m[1]));
    return null;
  }
  if (cell.t === "n" && typeof cell.v === "number" && cell.v >= 1 && cell.v < 2958466) {
    return cell.v;
  }
  return null;
}

function fmtNum(n: number, minFrac: number, maxFrac: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
    useGrouping: true,
  }).format(n);
}

export function plainText(cell: ExcelCell): string {
  if (cell.t === "blank") return "";
  if (cell.isDate && typeof cell.v === "number") {
    const hasTime = Math.abs(cell.v - Math.floor(cell.v)) > 1e-6;
    return formatDatePattern(cell.v, hasTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD");
  }
  if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
  if (typeof cell.v === "number") return String(cell.v);
  return cell.v === null ? cell.d : String(cell.v);
}

export function resolveBlankMode(
  setting: PlaceholderSetting,
  fallback: BlankDefault,
): BlankDefault {
  if (setting.blank === "default") return fallback;
  return { mode: setting.blank, text: setting.blankText ?? "" };
}

/** 依用戶設定格式化單一儲存格 */
export function formatCell(
  cell: ExcelCell | undefined,
  settingIn: PlaceholderSetting | undefined,
  blankDefault: BlankDefault,
): FormatOutcome {
  const setting = settingIn ?? DEFAULT_PLACEHOLDER_SETTING;
  if (!cell || cell.t === "blank") {
    const b = resolveBlankMode(setting, blankDefault);
    if (b.mode === "skip") return { text: "", blank: true, skip: true };
    if (b.mode === "custom") return { text: b.text, blank: true, skip: false };
    return { text: "", blank: true, skip: false };
  }
  const ok = (text: string): FormatOutcome => ({ text, blank: false, skip: false });
  switch (setting.format) {
    case "excel":
      return ok(cell.d);
    case "text":
      return ok(plainText(cell));
    case "number": {
      const n = toNumber(cell);
      if (n === null) return { text: cell.d, blank: false, skip: false, issue: "nan" };
      const dec = setting.decimals;
      return ok(dec === undefined ? fmtNum(n, 0, 6) : fmtNum(n, dec, dec));
    }
    case "currency": {
      const n = toNumber(cell);
      if (n === null) return { text: cell.d, blank: false, skip: false, issue: "nan" };
      const dec = setting.decimals ?? 2;
      const sym = setting.currencySymbol ?? "HK$";
      return ok(`${n < 0 ? "-" : ""}${sym}${fmtNum(Math.abs(n), dec, dec)}`);
    }
    case "percentage": {
      const n = toNumber(cell);
      if (n === null) return { text: cell.d, blank: false, skip: false, issue: "nan" };
      const dec = setting.decimals;
      const v = Math.round(n * 1e10) / 1e8;
      return ok(`${dec === undefined ? fmtNum(v, 0, 2) : fmtNum(v, dec, dec)}%`);
    }
    case "date":
    case "customDate": {
      const s = toSerial(cell);
      if (s === null) return { text: cell.d, blank: false, skip: false, issue: "baddate" };
      const pattern =
        setting.format === "customDate" ? setting.dateFormat || "DD/MM/YYYY" : "DD/MM/YYYY";
      return ok(formatDatePattern(s, pattern));
    }
    default:
      return ok(cell.d);
  }
}
