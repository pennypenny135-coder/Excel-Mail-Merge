import { clear, createStore, get, set, type UseStore } from "idb-keyval";
import type { Folder, Preferences, RecentExcel, Template } from "@/types/template";
import { DEFAULT_PREFERENCES } from "@/lib/template";

/**
 * 所有資料只存於瀏覽器 IndexedDB。
 * 注意：不會儲存完整 Excel 資料，只儲存最近使用 Excel 的 metadata。
 */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

let store: UseStore | null = null;
function getStore(): UseStore {
  if (!store) store = createStore("excel-mail-merge-studio", "kv");
  return store;
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await get<T>(key, getStore());
    return v === undefined ? fallback : v;
  } catch {
    throw new StorageError(
      "無法讀取本機儲存（IndexedDB）。請確認瀏覽器沒有使用無痕／私隱模式或封鎖網站資料，然後重新整理頁面。",
    );
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, value, getStore());
  } catch {
    throw new StorageError(
      "無法寫入本機儲存（IndexedDB）：可能是儲存空間已滿，或瀏覽器處於無痕／私隱模式。請先匯出 Template 備份、釋放瀏覽器儲存空間後再試。",
    );
  }
}

export const loadTemplates = () => read<Template[]>("templates", []);
export const saveTemplates = (v: Template[]) => write("templates", v);
export const loadFolders = () => read<Folder[]>("folders", []);
export const saveFolders = (v: Folder[]) => write("folders", v);
export const loadRecentExcel = () => read<RecentExcel[]>("recentExcel", []);
export const saveRecentExcel = (v: RecentExcel[]) => write("recentExcel", v);

export async function loadPreferences(): Promise<Preferences> {
  const p = await read<Partial<Preferences>>("preferences", {});
  return { ...DEFAULT_PREFERENCES, ...p };
}
export const savePreferences = (v: Preferences) => write("preferences", v);

export async function clearAllData(): Promise<void> {
  try {
    await clear(getStore());
    try {
      localStorage.removeItem("emms-theme");
    } catch {
      /* ignore */
    }
  } catch {
    throw new StorageError("無法清除本機資料。請在瀏覽器設定中手動清除此網站的資料。");
  }
}
