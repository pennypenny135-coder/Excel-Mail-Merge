"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/core";
import type { LoadedWorkbook, ParsedSheet } from "@/types/excel";
import type { Preferences, RecentExcel, Template } from "@/types/template";
import { useExcel, type UseExcel } from "@/hooks/useExcel";
import { useMailMerge, type UseMailMerge } from "@/hooks/useMailMerge";
import { useTemplates, type UseTemplates } from "@/hooks/useTemplates";
import { TRUNCATE_WARNING } from "@/lib/excel";
import { createEmptyTemplate, DEFAULT_PREFERENCES, extractPlaceholders } from "@/lib/template";
import {
  clearAllData,
  loadPreferences,
  loadRecentExcel,
  savePreferences,
  saveRecentExcel,
} from "@/lib/storage";
import { validateTemplate } from "@/lib/validation";
import type { BlankDefault } from "@/lib/formatting";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type View = "dashboard" | "excel" | "templates" | "editor" | "merge" | "settings";

export interface ToastItem {
  id: number;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
}

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** 額外按鈕（回傳 "extra"） */
  extraText?: string;
}
interface PromptOptions {
  title: string;
  label: string;
  initial?: string;
  confirmText?: string;
}

interface AppCtx {
  view: View;
  setView: (v: View) => void;
  ready: boolean;
  prefs: Preferences;
  updatePrefs: (patch: Partial<Preferences>) => void;
  blankDefault: BlankDefault;
  templates: UseTemplates;
  excel: UseExcel;
  merge: UseMailMerge;
  recent: RecentExcel[];
  draft: Template | null;
  dirty: boolean;
  updateDraft: (patch: Partial<Template>) => void;
  saveDraft: () => Promise<boolean>;
  openTemplate: (id: string, goTo?: View) => Promise<void>;
  createTemplate: (folderId: string | null, name?: string) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string) => Promise<void>;
  registerFlush: (fn: (() => void) | null) => void;
  editorRef: MutableRefObject<Editor | null>;
  toasts: ToastItem[];
  toast: (t: Omit<ToastItem, "id">) => void;
  dismissToast: (id: number) => void;
  confirm: (o: ConfirmOptions) => Promise<"ok" | "extra" | "cancel">;
  prompt: (o: PromptOptions) => Promise<string | null>;
  clearData: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp 必須在 AppProvider 內使用");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("dashboard");
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [recent, setRecent] = useState<RecentExcel[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = ++toastId.current;
      setToasts((list) => [...list.slice(-4), { ...t, id }]);
      setTimeout(() => dismissToast(id), t.type === "error" ? 12000 : 6000);
    },
    [dismissToast],
  );

  const templates = useTemplates(
    useCallback(
      (msg: string) => toast({ type: "error", title: "本機儲存失敗", description: msg }),
      [toast],
    ),
  );

  const resetMergeRef = useRef<(s: ParsedSheet) => void>(() => {});
  const recentRef = useRef<RecentExcel[]>([]);
  useEffect(() => {
    recentRef.current = recent;
  }, [recent]);

  const onExcelLoaded = useCallback(
    (sheet: ParsedSheet, wb: LoadedWorkbook) => {
      resetMergeRef.current(sheet);
      if (sheet.truncated) toast({ type: "warning", title: TRUNCATE_WARNING, description: "如需處理更多資料，請將 Excel 拆分成多個檔案。" });
      const entry: RecentExcel = {
        fileName: wb.fileName,
        fileSize: wb.fileSize,
        sheetName: sheet.sheetName,
        headerRow: sheet.headerRow,
        rowCount: sheet.rows.length,
        columns: sheet.columns.map((c) => c.header),
        lastUsedAt: new Date().toISOString(),
      };
      const next = [entry, ...recentRef.current.filter((r) => r.fileName !== entry.fileName)].slice(0, 10);
      setRecent(next);
      saveRecentExcel(next).catch((e: unknown) =>
        toast({ type: "error", title: "無法儲存最近使用的 Excel 記錄", description: e instanceof Error ? e.message : undefined }),
      );
    },
    [toast],
  );
  const excel = useExcel(onExcelLoaded);
  const merge = useMailMerge(excel.sheet);
  useEffect(() => {
    resetMergeRef.current = merge.reset;
  }, [merge.reset]);

  /* ---- 偏好設定 ---- */
  useEffect(() => {
    Promise.all([loadPreferences(), loadRecentExcel()])
      .then(([p, r]) => {
        setPrefs(p);
        setRecent(r);
      })
      .catch((e: unknown) =>
        toast({ type: "error", title: "無法讀取本機設定", description: e instanceof Error ? e.message : undefined }),
      )
      .finally(() => setPrefsLoaded(true));
  }, [toast]);

  useEffect(() => {
    if (!prefsLoaded) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = prefs.theme === "dark" || (prefs.theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    try {
      localStorage.setItem("emms-theme", prefs.theme);
    } catch {
      /* ignore */
    }
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [prefs.theme, prefsLoaded]);

  const updatePrefs = useCallback(
    (patch: Partial<Preferences>) => {
      setPrefs((p) => {
        const next = { ...p, ...patch };
        savePreferences(next).catch((e: unknown) =>
          toast({ type: "error", title: "無法儲存設定", description: e instanceof Error ? e.message : undefined }),
        );
        return next;
      });
    },
    [toast],
  );

  const blankDefault = useMemo<BlankDefault>(
    () => ({ mode: prefs.defaultBlankMode, text: prefs.defaultBlankText }),
    [prefs.defaultBlankMode, prefs.defaultBlankText],
  );

  /* ---- 對話框 ---- */
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (r: "ok" | "extra" | "cancel") => void }) | null
  >(null);
  const [promptState, setPromptState] = useState<
    (PromptOptions & { resolve: (r: string | null) => void }) | null
  >(null);
  const [promptValue, setPromptValue] = useState("");

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<"ok" | "extra" | "cancel">((resolve) => setConfirmState({ ...o, resolve })),
    [],
  );
  const prompt = useCallback(
    (o: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setPromptValue(o.initial ?? "");
        setPromptState({ ...o, resolve });
      }),
    [],
  );

  /* ---- Template draft ---- */
  const [draft, setDraft] = useState<Template | null>(null);
  const [dirty, setDirty] = useState(false);
  const draftRef = useRef<Template | null>(null);
  const flushRef = useRef<(() => void) | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const registerFlush = useCallback((fn: (() => void) | null) => {
    flushRef.current = fn;
  }, []);

  const updateDraft = useCallback((patch: Partial<Template>) => {
    if (!draftRef.current) return;
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setDirty(true);
  }, []);

  const setDraftClean = useCallback((t: Template | null) => {
    draftRef.current = t;
    setDraft(t);
    setDirty(false);
  }, []);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    flushRef.current?.();
    const d = draftRef.current;
    if (!d) return false;
    const found = extractPlaceholders(d.content);
    const bindings: Template["bindings"] = {};
    const settings: Template["placeholders"] = {};
    for (const { name } of found) {
      const col = excel.sheet?.columns.find((c) => c.header === name);
      if (col) bindings[name] = { header: col.header, letter: col.letter };
      else if (d.bindings[name]) bindings[name] = d.bindings[name];
      if (d.placeholders[name]) settings[name] = d.placeholders[name];
    }
    const saved: Template = {
      ...d,
      name: d.name.trim() || "未命名 Template",
      bindings,
      placeholders: settings,
      updatedAt: new Date().toISOString(),
      version: d.version + 1,
    };
    const ok = await templates.saveTemplate(saved);
    if (!ok) return false;
    setDraftClean(saved);
    const issues = validateTemplate(saved, excel.sheet, excel.sheet?.rows ?? [], blankDefault).filter(
      (i) => i.level === "error" && i.id !== "no-rows",
    );
    if (issues.length > 0) {
      toast({
        type: "warning",
        title: `Template 已儲存，但有 ${issues.length} 個問題`,
        description: issues
          .slice(0, 3)
          .map((i) => i.message)
          .join("\n"),
      });
    } else {
      toast({ type: "success", title: "Template 已儲存 / Saved", description: `「${saved.name}」（版本 ${saved.version}）` });
    }
    return true;
  }, [excel.sheet, templates, blankDefault, toast, setDraftClean]);

  const openTemplate = useCallback(
    async (id: string, goTo: View = "editor") => {
      if (draftRef.current && draftRef.current.id !== id && dirty) {
        const r = await confirm({
          title: "有未儲存的變更",
          description: `「${draftRef.current.name}」有尚未儲存的修改。切換 Template 後這些修改會遺失。`,
          confirmText: "放棄修改並切換",
          danger: true,
        });
        if (r !== "ok") return;
      }
      const t = templates.templates.find((x) => x.id === id);
      if (!t) {
        toast({ type: "error", title: "找不到此 Template", description: "它可能已被刪除。請重新整理 Template 列表。" });
        return;
      }
      if (draftRef.current?.id !== id) setDraftClean({ ...t });
      setView(goTo);
    },
    [dirty, confirm, templates.templates, toast, setDraftClean],
  );

  const createTemplate = useCallback(
    async (folderId: string | null, name?: string) => {
      if (draftRef.current && dirty) {
        const r = await confirm({
          title: "有未儲存的變更",
          description: "目前編輯中的 Template 有尚未儲存的修改，建立新 Template 後會遺失。",
          confirmText: "放棄修改",
          danger: true,
        });
        if (r !== "ok") return;
      }
      const t = createEmptyTemplate(prefs, folderId, name);
      const ok = await templates.saveTemplate(t);
      if (!ok) return;
      setDraftClean(t);
      setView("editor");
      toast({ type: "success", title: "已建立 Template / Created", description: "請在編輯器中撰寫內容並拖入 Excel 欄位。" });
    },
    [dirty, confirm, prefs, templates, toast, setDraftClean],
  );

  const removeTemplate = useCallback(
    async (id: string) => {
      const t = templates.templates.find((x) => x.id === id);
      if (!t) return;
      const r = await confirm({
        title: "刪除 Template / Delete",
        description: `確定要刪除「${t.name}」嗎？此操作無法復原。建議先匯出備份。`,
        confirmText: "刪除",
        danger: true,
      });
      if (r !== "ok") return;
      if (await templates.deleteTemplate(id)) {
        if (draftRef.current?.id === id) setDraftClean(null);
        toast({ type: "success", title: `已刪除「${t.name}」` });
      }
    },
    [templates, confirm, toast, setDraftClean],
  );

  const duplicateTemplate = useCallback(
    async (id: string) => {
      const c = await templates.duplicateTemplate(id);
      if (c) toast({ type: "success", title: "已複製 Template / Duplicated", description: `「${c.name}」` });
    },
    [templates, toast],
  );

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const clearData = useCallback(async () => {
    const r = await confirm({
      title: "清除所有本機資料 / Clear local data",
      description:
        "這會永久刪除此瀏覽器內所有 Templates、資料夾、設定及最近使用記錄。建議先匯出 Template 備份。確定繼續？",
      confirmText: "全部清除",
      danger: true,
    });
    if (r !== "ok") return;
    try {
      await clearAllData();
      await templates.replaceAll([], []);
      setRecent([]);
      setPrefs(DEFAULT_PREFERENCES);
      setDraftClean(null);
      toast({ type: "success", title: "本機資料已清除" });
    } catch (e) {
      toast({ type: "error", title: "清除失敗", description: e instanceof Error ? e.message : undefined });
    }
  }, [confirm, templates, toast, setDraftClean]);

  const value: AppCtx = {
    view,
    setView,
    ready: prefsLoaded && templates.loaded,
    prefs,
    updatePrefs,
    blankDefault,
    templates,
    excel,
    merge,
    recent,
    draft,
    dirty,
    updateDraft,
    saveDraft,
    openTemplate,
    createTemplate,
    removeTemplate,
    duplicateTemplate,
    registerFlush,
    editorRef,
    toasts,
    toast,
    dismissToast,
    confirm,
    prompt,
    clearData,
  };

  const closeConfirm = (r: "ok" | "extra" | "cancel") => {
    confirmState?.resolve(r);
    setConfirmState(null);
  };
  const closePrompt = (r: string | null) => {
    promptState?.resolve(r);
    setPromptState(null);
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal
        open={!!confirmState}
        onClose={() => closeConfirm("cancel")}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        footer={
          <>
            <Button variant="outline" onClick={() => closeConfirm("cancel")}>
              {confirmState?.cancelText ?? "取消 / Cancel"}
            </Button>
            {confirmState?.extraText && (
              <Button variant="secondary" onClick={() => closeConfirm("extra")}>
                {confirmState.extraText}
              </Button>
            )}
            <Button variant={confirmState?.danger ? "destructive" : "default"} onClick={() => closeConfirm("ok")}>
              {confirmState?.confirmText ?? "確定 / OK"}
            </Button>
          </>
        }
      />
      <Modal
        open={!!promptState}
        onClose={() => closePrompt(null)}
        title={promptState?.title ?? ""}
        footer={
          <>
            <Button variant="outline" onClick={() => closePrompt(null)}>
              取消 / Cancel
            </Button>
            <Button onClick={() => closePrompt(promptValue)}>{promptState?.confirmText ?? "確定 / OK"}</Button>
          </>
        }
      >
        <label className="mb-1 block text-xs font-medium text-muted-foreground">{promptState?.label}</label>
        <Input
          autoFocus
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") closePrompt(promptValue);
          }}
        />
      </Modal>
    </Ctx.Provider>
  );
}
