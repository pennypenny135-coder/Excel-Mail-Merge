import JSZip from "jszip";
import type { ExportedTemplate, Folder, Template } from "@/types/template";
import {
  DEFAULT_MARGINS,
  TEMPLATE_VERSION,
  folderPathLabel,
  getFolderPath,
  uid,
} from "@/lib/template";
import { sanitizeFileName } from "@/lib/merge";

export const EXPORT_FORMAT = "excel-mail-merge-studio-templates";
export const EXPORT_FORMAT_VERSION = 1;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

function toExported(t: Template, folders: Folder[]): ExportedTemplate {
  const { folderId, ...rest } = t;
  return { ...rest, folderPath: getFolderPath(folders, folderId).map((f) => f.name) };
}

const README = `Excel Mail Merge Studio — Template 匯出檔
==========================================

此 ZIP 由 Excel Mail Merge Studio 匯出，包含：
  - manifest.json   匯出資訊（版本、日期、template 清單）
  - templates.json  所有 template 及資料夾結構（匯入時使用）
  - templates/*.json  每個 template 的獨立 JSON 檔（方便備份及檢視）
  - README.txt      本說明

如何匯入：
  1. 開啟 Excel Mail Merge Studio
  2. 到「Templates」或「設定」→「匯入 / Import」
  3. 選擇此 ZIP 檔案
  4. 如有同名 template，可選擇覆蓋、重新命名或略過

注意：ZIP 內不含任何 Excel 資料。請勿手動修改 templates.json 的結構。
`;

export async function exportTemplates(templates: Template[], folders: Folder[]): Promise<Blob> {
  const exportedAt = new Date().toISOString();
  const exported = templates.map((t) => toExported(t, folders));
  const zip = new JSZip();
  const files: { name: string; folderPath: string[]; file: string }[] = [];
  exported.forEach((t, i) => {
    const safe = sanitizeFileName(t.name) || "template";
    const file = `templates/${String(i + 1).padStart(3, "0")}-${safe}.json`;
    files.push({ name: t.name, folderPath: t.folderPath, file });
    zip.file(file, JSON.stringify(t, null, 2));
  });
  const usedFolders = new Map<string, string[]>();
  exported.forEach((t) => {
    for (let i = 1; i <= t.folderPath.length; i++) {
      usedFolders.set(t.folderPath.slice(0, i).join("\u0000"), t.folderPath.slice(0, i));
    }
  });
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        app: "Excel Mail Merge Studio",
        format: EXPORT_FORMAT,
        formatVersion: EXPORT_FORMAT_VERSION,
        exportedAt,
        templateCount: exported.length,
        folderCount: usedFolders.size,
        templates: files,
      },
      null,
      2,
    ),
  );
  zip.file(
    "templates.json",
    JSON.stringify(
      {
        format: EXPORT_FORMAT,
        formatVersion: EXPORT_FORMAT_VERSION,
        exportedAt,
        folders: Array.from(usedFolders.values()).map((path) => ({ path })),
        templates: exported,
      },
      null,
      2,
    ),
  );
  zip.file("README.txt", README);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

const PAGE_SIZES = ["A4", "A5", "Letter"];
const ORIENTATIONS = ["portrait", "landscape"];

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** 驗證並正規化單一 template；失敗時回傳錯誤字串 */
export function normalizeExported(raw: unknown, index: number): ExportedTemplate | string {
  const label = `第 ${index + 1} 個 template`;
  if (!raw || typeof raw !== "object") return `${label}：格式不正確（不是物件）。`;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim()) return `${label}：缺少 name（名稱）。`;
  if (typeof o.content !== "string") return `${label}（${o.name}）：缺少 content（內容）。`;
  const m = (o.margins ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const folderPath = Array.isArray(o.folderPath)
    ? o.folderPath.filter((p): p is string => typeof p === "string" && p.trim() !== "")
    : [];
  return {
    id: typeof o.id === "string" ? o.id : uid(),
    name: o.name.trim(),
    description: typeof o.description === "string" ? o.description : "",
    createdAt: typeof o.createdAt === "string" ? o.createdAt : now,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : now,
    pageSize: PAGE_SIZES.includes(o.pageSize as string) ? (o.pageSize as Template["pageSize"]) : "A4",
    orientation: ORIENTATIONS.includes(o.orientation as string)
      ? (o.orientation as Template["orientation"])
      : "portrait",
    margins: {
      top: num(m.top, DEFAULT_MARGINS.top),
      right: num(m.right, DEFAULT_MARGINS.right),
      bottom: num(m.bottom, DEFAULT_MARGINS.bottom),
      left: num(m.left, DEFAULT_MARGINS.left),
    },
    fontFamily: typeof o.fontFamily === "string" ? o.fontFamily : "Microsoft JhengHei",
    fontSize: num(o.fontSize, 11),
    content: o.content,
    bindings:
      o.bindings && typeof o.bindings === "object" ? (o.bindings as Template["bindings"]) : {},
    placeholders:
      o.placeholders && typeof o.placeholders === "object"
        ? (o.placeholders as Template["placeholders"])
        : {},
    version: num(o.version, TEMPLATE_VERSION),
    folderPath,
  };
}

export interface ImportItem {
  key: string;
  template: ExportedTemplate;
  conflict: Template | null;
  action: "import" | "overwrite" | "rename" | "skip";
}

export interface ImportPlan {
  items: ImportItem[];
  errors: string[];
}

export async function parseImportFile(
  file: File,
  existing: Template[],
  folders: Folder[],
): Promise<ImportPlan> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new ImportError("匯入檔案必須是 .zip（由本 app 匯出）。請選擇正確的檔案。");
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new ImportError("無法開啟此 ZIP 檔案，檔案可能已損壞。請重新匯出或重新下載後再試。");
  }
  let rawTemplates: unknown[] | null = null;
  const tj = zip.file("templates.json");
  if (tj) {
    try {
      const parsed = JSON.parse(await tj.async("string")) as { templates?: unknown };
      if (Array.isArray(parsed.templates)) rawTemplates = parsed.templates;
    } catch {
      throw new ImportError("templates.json 不是有效的 JSON。請確認 ZIP 沒有被手動修改。");
    }
  }
  if (!rawTemplates) {
    const files = Object.keys(zip.files).filter((n) => /^templates\/.+\.json$/.test(n));
    if (files.length === 0) {
      throw new ImportError("ZIP 內找不到 templates.json 或 templates/*.json。請確認這是由本 app 匯出的檔案。");
    }
    rawTemplates = [];
    for (const f of files) {
      try {
        rawTemplates.push(JSON.parse(await (zip.file(f) as JSZip.JSZipObject).async("string")));
      } catch {
        /* 由 normalize 報錯 */
        rawTemplates.push(null);
      }
    }
  }
  const items: ImportItem[] = [];
  const errors: string[] = [];
  rawTemplates.forEach((raw, i) => {
    const r = normalizeExported(raw, i);
    if (typeof r === "string") {
      errors.push(r);
      return;
    }
    const pathStr = r.folderPath.slice(0, 3).join("/");
    const conflict =
      existing.find(
        (t) =>
          t.name === r.name &&
          getFolderPath(folders, t.folderId)
            .map((f) => f.name)
            .join("/") === pathStr,
      ) ?? null;
    items.push({ key: `${i}-${r.id}`, template: r, conflict, action: conflict ? "rename" : "import" });
  });
  return { items, errors };
}

export function describeFolder(folders: Folder[], id: string | null) {
  return folderPathLabel(folders, id);
}
