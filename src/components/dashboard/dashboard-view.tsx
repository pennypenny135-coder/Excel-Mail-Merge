"use client";

import { useState } from "react";
import { Clock, FileSpreadsheet, FilePlus2, FileText, Mail, Upload } from "lucide-react";
import { useApp } from "@/components/app-context";
import { ExcelDropzone } from "@/components/excel/excel-dropzone";
import { ImportDialog } from "@/components/templates/import-dialog";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/misc";
import { extractPlaceholders, folderPathLabel } from "@/lib/template";

export function DashboardView() {
  const app = useApp();
  const { templates, recent, excel } = app;
  const [importOpen, setImportOpen] = useState(false);
  const recentTemplates = [...templates.templates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Excel Mail Merge Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            上載 Excel → 撰寫 Template → 拖入欄位 → 批次產生 Word (.docx)。所有處理都在你的瀏覽器內完成。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span> 上載 Excel / Upload Excel</div>
            {excel.workbook && excel.sheet ? (
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-success" /> <span className="truncate font-medium">{excel.workbook.fileName}</span></p>
                <p className="text-xs text-muted-foreground">{excel.sheet.sheetName} · {excel.sheet.rows.length.toLocaleString()} 行 · {excel.sheet.columns.length} 欄</p>
                <Button size="sm" variant="outline" onClick={() => app.setView("excel")}>檢視資料</Button>
              </div>
            ) : (
              <ExcelDropzone compact goToExcel />
            )}
          </Card>
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span> 建立 Template / Create Template</div>
            <p className="text-xs text-muted-foreground">在內建編輯器撰寫，或由 Word 複製貼上，再把 Excel 欄位拖進去。</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void app.createTemplate(null)}><FilePlus2 className="h-4 w-4" /> 快速建立</Button>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> 匯入 Import</Button>
            </div>
          </Card>
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span> 產生文件 / Generate</div>
            <p className="text-xs text-muted-foreground">預覽合併結果、驗證資料，然後一次下載所有 .docx（ZIP）。</p>
            <Button size="sm" variant="outline" onClick={() => app.setView("merge")}><Mail className="h-4 w-4" /> 前往郵件合併</Button>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => app.setView("templates")}>全部</Button>}>最近 Templates</SectionTitle>
            {recentTemplates.length === 0 ? (
              <EmptyState icon={<FileText className="h-5 w-5" />} title="還沒有 Template" description="建立第一個 Template 開始使用。" />
            ) : (
              <ul className="space-y-2">
                {recentTemplates.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => void app.openTemplate(t.id)} className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left hover:border-primary/50">
                      <FileText className="h-5 w-5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{folderPathLabel(templates.folders, t.folderId)} · {new Date(t.updatedAt).toLocaleDateString("zh-HK")}</span>
                      </span>
                      <Badge tone="primary">{extractPlaceholders(t.content).length} 欄位</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <SectionTitle>最近使用的 Excel</SectionTitle>
            {recent.length === 0 ? (
              <EmptyState icon={<Clock className="h-5 w-5" />} title="沒有最近記錄" description="為保障私隱，只會記錄檔名及欄位名稱，不會儲存 Excel 內容。" />
            ) : (
              <ul className="space-y-2">
                {recent.slice(0, 5).map((r) => (
                  <li key={r.fileName} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <FileSpreadsheet className="h-5 w-5 shrink-0 text-success" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.fileName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.sheetName} · {r.rowCount.toLocaleString()} 行 · {new Date(r.lastUsedAt).toLocaleString("zh-HK")}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">欄位：{r.columns.slice(0, 6).join("、")}{r.columns.length > 6 ? "…" : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">重新整理後需要重新上載 Excel；Template 及設定會保留。</p>
          </div>
        </div>
      </div>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
