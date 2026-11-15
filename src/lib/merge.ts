import type { ExcelRow, ParsedSheet } from "@/types/excel";
import type { MergeSettings } from "@/types/merge";
import type { Template } from "@/types/template";
import { formatCell, type BlankDefault } from "@/lib/formatting";

export interface MergeResult {
  html: string;
  skipped: boolean;
  skipReason?: string;
  missing: string[];
  blanks: string[];
}

export function buildHeaderMap(sheet: ParsedSheet): Map<string, number> {
  const map = new Map<string, number>();
  sheet.columns.forEach((c, i) => map.set(c.header, i));
  return map;
}

/**
 * 將一行 Excel 資料合併進 template HTML。
 * markup=true：用於預覽（標示已填入值及缺漏欄位）；false：用於 .docx 產生。
 */
export function mergeRow(
  template: Template,
  sheet: ParsedSheet,
  row: ExcelRow,
  blankDefault: BlankDefault,
  markup: boolean,
  headerMap?: Map<string, number>,
): MergeResult {
  const map = headerMap ?? buildHeaderMap(sheet);
  const doc = new DOMParser().parseFromString(`<body>${template.content}</body>`, "text/html");
  const missing: string[] = [];
  const blanks: string[] = [];
  let skipReason: string | undefined;

  // 安全：匯入的 template 可能含惡意 HTML，移除腳本及事件屬性
  doc.body.querySelectorAll("script, iframe, object, embed, style, link, meta, form").forEach((n) => n.remove());
  doc.body.querySelectorAll("*").forEach((n) => {
    Array.from(n.attributes).forEach((a) => {
      if (a.name.toLowerCase().startsWith("on") || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
    });
  });

  doc.querySelectorAll("span[data-merge-field]").forEach((el) => {
    const name = el.getAttribute("data-merge-field") ?? "";
    const idx = map.get(name);
    const frag = doc.createDocumentFragment();
    if (idx === undefined) {
      missing.push(name);
      if (markup) {
        const s = doc.createElement("span");
        s.className = "mf-missing";
        s.textContent = `{{${name}}}`;
        frag.appendChild(s);
      }
    } else {
      const out = formatCell(row.cells[idx], template.placeholders[name], blankDefault);
      if (out.blank) blanks.push(name);
      if (out.skip && !skipReason) skipReason = `欄位「${name}」為空白（設定為略過此行）`;
      const holder = markup ? doc.createElement("span") : frag;
      if (markup) (holder as HTMLElement).className = out.blank && !out.text ? "mf-value mf-empty" : "mf-value";
      const parts = out.text.split(/\r?\n/);
      parts.forEach((p, i) => {
        if (i > 0) holder.appendChild(doc.createElement("br"));
        if (p) holder.appendChild(doc.createTextNode(p));
      });
      if (markup) {
        if (out.blank && !out.text) holder.appendChild(doc.createTextNode("\u00a0\u00a0"));
        frag.appendChild(holder);
      }
    }
    el.replaceWith(frag);
  });

  return {
    html: doc.body.innerHTML,
    skipped: !!skipReason,
    skipReason,
    missing,
    blanks,
  };
}

export function selectRows(sheet: ParsedSheet | null, s: MergeSettings): ExcelRow[] {
  if (!sheet) return [];
  switch (s.rowMode) {
    case "all":
      return sheet.rows;
    case "range":
      return sheet.rows.filter((r) => r.rowNumber >= s.rangeFrom && r.rowNumber <= s.rangeTo);
    case "manual": {
      const set = new Set(s.manual);
      return sheet.rows.filter((r) => set.has(r.rowNumber));
    }
    case "filter": {
      const v = s.filterValue.trim().toLowerCase();
      if (!v) return sheet.rows;
      return sheet.rows.filter((r) => {
        const cell = (r.cells[s.filterColumn]?.d ?? "").trim().toLowerCase();
        return s.filterOp === "equals" ? cell === v : cell.includes(v);
      });
    }
    default:
      return sheet.rows;
  }
}

/* ---------------- 檔名處理 ---------------- */

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function sanitizeFileName(raw: string): string {
  let s = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
  s = s.replace(/[. ]+$/, "");
  if (s.length > 80) s = s.slice(0, 80).trim();
  if (!s || RESERVED.test(s)) return "";
  return s;
}

/** 依規則產生唯一檔名（不含副檔名以外的部份），重複時加 -2、-3 */
export function makeFileNames(
  rows: ExcelRow[],
  columnIndex: number,
  existingTotal = rows.length,
): string[] {
  const used = new Set<string>();
  const pad = Math.max(3, String(existingTotal).length);
  return rows.map((row, i) => {
    const raw = row.cells[columnIndex]?.d ?? "";
    let base = sanitizeFileName(raw);
    if (!base) base = `Document_${String(i + 1).padStart(pad, "0")}`;
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${base}-${n++}`;
    used.add(name.toLowerCase());
    return `${name}.docx`;
  });
}
