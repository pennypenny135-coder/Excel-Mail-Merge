"use client";

import dynamic from "next/dynamic";
import {
  FileSpreadsheet,
  FileText,
  FolderTree,
  LayoutDashboard,
  Mail,
  Moon,
  PenLine,
  Save,
  Settings,
  ShieldCheck,
  Sun,
  X,
  Play,
} from "lucide-react";
import { useApp, type View } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { Badge, ProgressBar, Spinner } from "@/components/ui/misc";
import { cn } from "@/components/ui/utils";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ExcelView } from "@/components/excel/excel-view";
import { TemplatesView } from "@/components/templates/templates-view";
import { MergeView } from "@/components/merge/merge-view";
import { SettingsView } from "@/components/settings/settings-view";

const EditorView = dynamic(() => import("@/components/editor/editor-view").then((m) => m.EditorView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner /> 載入編輯器 / Loading editor…
    </div>
  ),
});

const NAV: { id: View; label: string; en: string; icon: typeof FileText }[] = [
  { id: "dashboard", label: "首頁", en: "Dashboard", icon: LayoutDashboard },
  { id: "excel", label: "Excel 資料", en: "Excel Data", icon: FileSpreadsheet },
  { id: "templates", label: "Templates", en: "Templates", icon: FolderTree },
  { id: "editor", label: "編輯器", en: "Editor", icon: PenLine },
  { id: "merge", label: "郵件合併", en: "Mail Merge", icon: Mail },
  { id: "settings", label: "設定", en: "Settings", icon: Settings },
];

export function AppShell() {
  const app = useApp();
  const { view, setView, excel, draft, dirty, merge } = app;

  return (
    <div className="flex h-screen flex-col">
      {/* 頂部列 */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mail className="h-4 w-4" />
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold">Excel Mail Merge Studio</p>
            <p className="text-[11px] text-muted-foreground">Excel → Word 批次文件</p>
          </div>
        </div>
        <div className="mx-2 hidden h-6 w-px bg-border md:block" />
        <button
          className="hidden min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted md:flex"
          onClick={() => setView("excel")}
          title="前往 Excel 資料 / Excel Data"
        >
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-success" />
          {excel.workbook ? (
            <span className="min-w-0 text-xs">
              <span className="block max-w-[220px] truncate font-medium">{excel.workbook.fileName}</span>
              <span className="text-muted-foreground">
                {excel.sheet ? `${excel.sheet.sheetName} · ${excel.sheet.rows.length.toLocaleString()} 行` : "無法使用的工作表"}
              </span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">尚未上載 Excel / No file</span>
          )}
        </button>
        {draft && (
          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="max-w-[200px] truncate text-xs font-medium">{draft.name}</span>
            {dirty ? <Badge tone="warning">未儲存</Badge> : <Badge tone="success">已儲存</Badge>}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => app.updatePrefs({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" })}
            title="切換 Light / Dark mode"
            aria-label="切換主題 / Toggle theme"
          >
            <Sun className="hidden h-4 w-4 dark:block" />
            <Moon className="h-4 w-4 dark:hidden" />
          </Button>
          <Button variant="outline" disabled={!draft} onClick={() => void app.saveDraft()} title="儲存 Template / Save">
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">儲存 Save</span>
          </Button>
          <Button onClick={() => setView("merge")} title="前往郵件合併並產生文件 / Generate Documents">
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">產生文件 Generate</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 導覽 */}
        <nav className="flex w-14 shrink-0 flex-col gap-1 border-r bg-card p-2 lg:w-44">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                title={`${n.label} / ${n.en}`}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors",
                  active ? "bg-accent font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden min-w-0 truncate lg:block">
                  {n.label}
                  <span className="ml-1 text-[11px] opacity-70">{n.en !== n.label ? n.en : ""}</span>
                </span>
              </button>
            );
          })}
          <div className="mt-auto hidden rounded-lg bg-muted p-2.5 text-[11px] leading-relaxed text-muted-foreground lg:block">
            <ShieldCheck className="mb-1 h-4 w-4 text-success" />
            所有資料只在你的瀏覽器處理，不會上傳到任何伺服器。
          </div>
        </nav>

        {/* 主內容 */}
        <main className="min-w-0 flex-1 overflow-hidden">
          {!app.ready ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner /> 載入本機資料 / Loading…
            </div>
          ) : (
            <>
              {view === "dashboard" && <DashboardView />}
              {view === "excel" && <ExcelView />}
              {view === "templates" && <TemplatesView />}
              {view === "editor" && <EditorView />}
              {view === "merge" && <MergeView />}
              {view === "settings" && <SettingsView />}
            </>
          )}
        </main>
      </div>

      {/* 狀態列 */}
      <footer className="flex h-7 shrink-0 items-center gap-3 border-t bg-card px-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-success" /> 本機處理 Local only
        </span>
        {excel.loading && (
          <span className="flex items-center gap-1">
            <Spinner className="h-3 w-3" /> 讀取 Excel…
          </span>
        )}
        {merge.progress.running && (
          <span className="flex items-center gap-2">
            <Spinner className="h-3 w-3" />
            {merge.progress.phase === "zip"
              ? "正在打包 ZIP…"
              : `Generating ${merge.progress.current.toLocaleString()} / ${merge.progress.total.toLocaleString()} documents...`}
            <span className="w-28">
              <ProgressBar value={merge.progress.current} max={merge.progress.total} />
            </span>
          </span>
        )}
        <span className="ml-auto">{draft ? (dirty ? "● 有未儲存的變更" : "✓ 所有變更已儲存") : "未開啟 Template"}</span>
      </footer>

      {/* Toasts */}
      <div className="pointer-events-none fixed right-4 bottom-10 z-[60] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {app.toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-lg border bg-card p-3 text-sm shadow-lg",
              t.type === "error" && "border-destructive/60",
              t.type === "warning" && "border-warning/60",
              t.type === "success" && "border-success/60",
            )}
            role={t.type === "error" ? "alert" : "status"}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs whitespace-pre-line text-muted-foreground">{t.description}</p>}
            </div>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => app.dismissToast(t.id)} aria-label="關閉">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
