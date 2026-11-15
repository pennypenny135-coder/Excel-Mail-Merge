"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Folder, Template } from "@/types/template";
import {
  MAX_FOLDER_DEPTH,
  ensureFolderPath,
  getDescendantIds,
  getFolderDepth,
  getSubtreeHeight,
  uid,
  uniqueName,
} from "@/lib/template";
import { loadFolders, loadTemplates, saveFolders, saveTemplates } from "@/lib/storage";
import type { ImportItem } from "@/lib/transfer";

export function useTemplates(onError: (msg: string) => void) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const tRef = useRef<Template[]>([]);
  const fRef = useRef<Folder[]>([]);
  const errRef = useRef(onError);
  useEffect(() => {
    errRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadTemplates(), loadFolders()])
      .then(([t, f]) => {
        if (cancelled) return;
        tRef.current = t;
        fRef.current = f;
        setTemplates(t);
        setFolders(f);
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        errRef.current(e instanceof Error ? e.message : "無法讀取本機儲存。");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback(async (nt?: Template[], nf?: Folder[]): Promise<boolean> => {
    try {
      if (nt) {
        tRef.current = nt;
        setTemplates(nt);
        await saveTemplates(nt);
      }
      if (nf) {
        fRef.current = nf;
        setFolders(nf);
        await saveFolders(nf);
      }
      return true;
    } catch (e) {
      errRef.current(e instanceof Error ? e.message : "儲存失敗。");
      return false;
    }
  }, []);

  const saveTemplate = useCallback(
    (t: Template) => {
      const list = tRef.current;
      const next = list.some((x) => x.id === t.id)
        ? list.map((x) => (x.id === t.id ? t : x))
        : [...list, t];
      return commit(next);
    },
    [commit],
  );

  const duplicateTemplate = useCallback(
    async (id: string): Promise<Template | null> => {
      const src = tRef.current.find((t) => t.id === id);
      if (!src) return null;
      const now = new Date().toISOString();
      const copy: Template = {
        ...src,
        id: uid(),
        name: `${src.name} (副本)`,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      return (await commit([...tRef.current, copy])) ? copy : null;
    },
    [commit],
  );

  const deleteTemplate = useCallback(
    (id: string) => commit(tRef.current.filter((t) => t.id !== id)),
    [commit],
  );

  const moveTemplate = useCallback(
    (id: string, folderId: string | null) =>
      commit(
        tRef.current.map((t) =>
          t.id === id ? { ...t, folderId, updatedAt: new Date().toISOString() } : t,
        ),
      ),
    [commit],
  );

  /** 回傳錯誤訊息；成功則回傳 null */
  const createFolder = useCallback(
    async (name: string, parentId: string | null): Promise<string | null> => {
      const n = name.trim();
      if (!n) return "資料夾名稱不可為空白。請輸入名稱。";
      const depth = getFolderDepth(fRef.current, parentId);
      if (depth >= MAX_FOLDER_DEPTH) {
        return `資料夾最多只能有 ${MAX_FOLDER_DEPTH} 層。請選擇較上層的資料夾來建立。`;
      }
      if (fRef.current.some((f) => f.parentId === parentId && f.name === n)) {
        return `此位置已有名為「${n}」的資料夾。請使用其他名稱。`;
      }
      const f: Folder = { id: uid(), name: n, parentId, createdAt: new Date().toISOString() };
      return (await commit(undefined, [...fRef.current, f])) ? null : "儲存失敗。";
    },
    [commit],
  );

  const renameFolder = useCallback(
    async (id: string, name: string): Promise<string | null> => {
      const n = name.trim();
      if (!n) return "資料夾名稱不可為空白。請輸入名稱。";
      const cur = fRef.current.find((f) => f.id === id);
      if (!cur) return "找不到此資料夾。";
      if (fRef.current.some((f) => f.id !== id && f.parentId === cur.parentId && f.name === n)) {
        return `此位置已有名為「${n}」的資料夾。請使用其他名稱。`;
      }
      return (await commit(undefined, fRef.current.map((f) => (f.id === id ? { ...f, name: n } : f))))
        ? null
        : "儲存失敗。";
    },
    [commit],
  );

  const moveFolder = useCallback(
    async (id: string, newParentId: string | null): Promise<string | null> => {
      const cur = fRef.current.find((f) => f.id === id);
      if (!cur) return "找不到此資料夾。";
      if (newParentId === id || (newParentId && getDescendantIds(fRef.current, id).includes(newParentId))) {
        return "不能將資料夾移到它自己或其子資料夾內。";
      }
      const depth = getFolderDepth(fRef.current, newParentId) + getSubtreeHeight(fRef.current, id);
      if (depth > MAX_FOLDER_DEPTH) {
        return `移動後會超過 ${MAX_FOLDER_DEPTH} 層限制。請選擇較上層的位置。`;
      }
      if (fRef.current.some((f) => f.id !== id && f.parentId === newParentId && f.name === cur.name)) {
        return `目標位置已有同名資料夾「${cur.name}」。請先重新命名。`;
      }
      return (
        (await commit(
          undefined,
          fRef.current.map((f) => (f.id === id ? { ...f, parentId: newParentId } : f)),
        ))
          ? null
          : "儲存失敗。"
      );
    },
    [commit],
  );

  const deleteFolder = useCallback(
    async (id: string, mode: "move" | "delete"): Promise<boolean> => {
      const ids = new Set([id, ...getDescendantIds(fRef.current, id)]);
      const nf = fRef.current.filter((f) => !ids.has(f.id));
      const nt =
        mode === "delete"
          ? tRef.current.filter((t) => !(t.folderId && ids.has(t.folderId)))
          : tRef.current.map((t) => (t.folderId && ids.has(t.folderId) ? { ...t, folderId: null } : t));
      return commit(nt, nf);
    },
    [commit],
  );

  const applyImport = useCallback(
    async (items: ImportItem[]): Promise<number> => {
      let ts = tRef.current;
      let fs = fRef.current;
      let count = 0;
      for (const it of items) {
        if (it.action === "skip") continue;
        const ensured = ensureFolderPath(fs, it.template.folderPath);
        fs = ensured.folders;
        const { folderPath, ...rest } = it.template;
        void folderPath;
        const now = new Date().toISOString();
        if (it.action === "overwrite" && it.conflict) {
          const keep = it.conflict;
          ts = ts.map((t) =>
            t.id === keep.id
              ? { ...rest, id: keep.id, folderId: ensured.folderId, createdAt: keep.createdAt, updatedAt: now, version: keep.version + 1 }
              : t,
          );
        } else {
          let name = rest.name;
          if (it.action === "rename" || ts.some((t) => t.folderId === ensured.folderId && t.name === name)) {
            const taken = ts.filter((t) => t.folderId === ensured.folderId).map((t) => t.name);
            name = uniqueName(`${rest.name} (匯入)`, taken);
          }
          ts = [...ts, { ...rest, id: uid(), name, folderId: ensured.folderId, updatedAt: now }];
        }
        count++;
      }
      const ok = await commit(ts, fs);
      return ok ? count : 0;
    },
    [commit],
  );

  const replaceAll = useCallback(
    (t: Template[], f: Folder[]) => commit(t, f),
    [commit],
  );

  return {
    templates,
    folders,
    loaded,
    saveTemplate,
    duplicateTemplate,
    deleteTemplate,
    moveTemplate,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    applyImport,
    replaceAll,
  };
}

export type UseTemplates = ReturnType<typeof useTemplates>;
