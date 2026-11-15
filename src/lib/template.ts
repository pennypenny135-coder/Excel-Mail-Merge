import type {
  Folder,
  Margins,
  Orientation,
  PageSize,
  Preferences,
  Template,
} from "@/types/template";

export const TEMPLATE_VERSION = 1;
export const MAX_FOLDER_DEPTH = 3;

export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "新細明體 PMingLiU", value: "PMingLiU" },
  { label: "微軟正黑體 JhengHei", value: "Microsoft JhengHei" },
  { label: "標楷體 DFKai-SB", value: "DFKai-SB" },
  { label: "Arial", value: "Arial" },
  { label: "Calibri", value: "Calibri" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Georgia", value: "Georgia" },
  { label: "Verdana", value: "Verdana" },
  { label: "Courier New", value: "Courier New" },
];

export const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];

/** 頁面尺寸（mm，portrait） */
export const PAGE_MM: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  Letter: { w: 215.9, h: 279.4 },
};

export const DEFAULT_MARGINS: Margins = { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 };

export const DEFAULT_PREFERENCES: Preferences = {
  defaultPageSize: "A4",
  defaultOrientation: "portrait",
  defaultFontFamily: "Microsoft JhengHei",
  defaultFontSize: 11,
  defaultBlankMode: "blank",
  defaultBlankText: "N/A",
  theme: "system",
};

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyTemplate(prefs: Preferences, folderId: string | null, name?: string): Template {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: name || "未命名 Template",
    folderId,
    description: "",
    createdAt: now,
    updatedAt: now,
    pageSize: prefs.defaultPageSize,
    orientation: prefs.defaultOrientation,
    margins: { ...DEFAULT_MARGINS },
    fontFamily: prefs.defaultFontFamily,
    fontSize: prefs.defaultFontSize,
    content: "<p>敬啟者：</p><p></p><p></p>",
    bindings: {},
    placeholders: {},
    version: TEMPLATE_VERSION,
  };
}

export function pageDimensionsMm(size: PageSize, orientation: Orientation): { w: number; h: number } {
  const p = PAGE_MM[size];
  return orientation === "landscape" ? { w: p.h, h: p.w } : p;
}

export function primaryFontName(css: string): string {
  const first = css.split(",")[0] ?? "";
  return first.replace(/["']/g, "").trim() || "Arial";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** 由 template HTML 取出 placeholder 名稱及出現次數 */
export function extractPlaceholders(html: string): { name: string; count: number }[] {
  const map = new Map<string, number>();
  const re = /data-merge-field="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = decodeEntities(m[1]);
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map, ([name, count]) => ({ name, count }));
}

/* ---------------- Folder helpers ---------------- */

export function getFolderPath(folders: Folder[], id: string | null): Folder[] {
  const path: Folder[] = [];
  let cur = id ? folders.find((f) => f.id === id) : undefined;
  let guard = 0;
  while (cur && guard++ < 10) {
    path.unshift(cur);
    const pid: string | null = cur.parentId;
    cur = pid ? folders.find((f) => f.id === pid) : undefined;
  }
  return path;
}

export function folderPathLabel(folders: Folder[], id: string | null): string {
  const p = getFolderPath(folders, id);
  return p.length ? p.map((f) => f.name).join(" / ") : "（根目錄 / Root）";
}

export function getFolderDepth(folders: Folder[], id: string | null): number {
  return getFolderPath(folders, id).length;
}

export function getDescendantIds(folders: Folder[], id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop() as string;
    for (const f of folders) {
      if (f.parentId === cur) {
        out.push(f.id);
        stack.push(f.id);
      }
    }
  }
  return out;
}

export function getSubtreeHeight(folders: Folder[], id: string): number {
  const kids = folders.filter((f) => f.parentId === id);
  if (kids.length === 0) return 1;
  return 1 + Math.max(...kids.map((k) => getSubtreeHeight(folders, k.id)));
}

/** 確保資料夾路徑存在（最多三層），回傳新 folders 及最底層 folderId */
export function ensureFolderPath(
  folders: Folder[],
  path: string[],
): { folders: Folder[]; folderId: string | null } {
  let list = folders;
  let parentId: string | null = null;
  const clean = path.map((p) => p.trim()).filter(Boolean).slice(0, MAX_FOLDER_DEPTH);
  for (const name of clean) {
    const pid: string | null = parentId;
    const found: Folder | undefined = list.find((f) => f.parentId === pid && f.name === name);
    if (found) {
      parentId = found.id;
    } else {
      const nf: Folder = { id: uid(), name, parentId: pid, createdAt: new Date().toISOString() };
      list = [...list, nf];
      parentId = nf.id;
    }
  }
  return { folders: list, folderId: parentId };
}

export function uniqueName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}
