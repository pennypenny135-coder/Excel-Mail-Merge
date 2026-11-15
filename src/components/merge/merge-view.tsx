"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Play } from "lucide-react";
import { useApp } from "@/components/app-context";
import { ExcelDropzone } from "@/components/excel/excel-dropzone";
import { MergePreview } from "@/components/merge/preview";
import { ValidationPanel } from "@/components/merge/validation-panel";
import { MAX_INDIVIDUAL_FILES } from "@/hooks/useMailMerge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Alert, Badge, EmptyState, ProgressBar, SectionTitle } from "@/components/ui/misc";
import { cn } from "@/components/ui/utils";
import { makeFileNames } from "@/lib/merge";
import { validateTemplate } from "@/lib/validation";
import type { PreviewMode, RowMode } from "@/types/merge";

const ROW_MODES: { id: RowMode; label: string }[] = [
  { id: "all", label: "全部 All rows" },
  { id: "range", label: "自訂範圍 Range" },
  { id: "manual", label: "手動勾選 Manual" },
  { id: "filter", label: "條件篩選 Filter" },
];

export function MergeView() {
  const { draft, templates, excel, merge, blankDefault, openTemplate, confirm, toast, setView } = useApp();
  const [zoom, setZoom] = useState(70);
  const [plain, setPlain] = useState(false);
  const [showCount, setShowCount] = useState(20);
  const sheet = excel.sheet;
  const { settings, selectedRows, progress, result } = merge;

  const issues = useMemo(
    () => (draft ? validateTemplate(draft, sheet, selectedRows, blankDefault) : []),
    [draft, sheet, selectedRows, blankDefault],
  );
  const errorCount = issues.filter((i) => i.level === "error").length;

  const fileNames = useMemo(() => {
    const map = new Map<number, string>();
    if (!sheet) return map;
    const names = makeFileNames(selectedRows, Math.min(settings.fileNameColumn, sheet.columns.length - 1));
    selectedRows.forEach((r, i) => map.set(r.rowNumber, names[i]));
    return map;
  }, [sheet, selectedRows, settings.fileNameColumn]);

  const previewRows = useMemo(() => {
    switch (settings.previewMode) {
      case "first":
        return selectedRows.slice(0, 1);
      case "single": {
        const r = selectedRows.find((x) => x.rowNumber === settings.previewRow) ?? selectedRows[0];
        return r ? [r] : [];
      }
      case "first10":
        return selectedRows.slice(0, 10);
      default:
        return selectedRows.slice(0, showCount);
    }
  }, [selectedRows, settings.previewMode, settings.previewRow, showCount]);

  if (!draft || !sheet) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-xl space-y-4">
          <div>
            <h1 className="text-xl font-semibold">郵件合併 / Mail Merge</h1>
            <p className="mt-1 text-sm text-muted-foreground">需要同時有 Template 及 Excel 資料，才能預覽及產生文件。</p>
          </div>
          {!draft && (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="尚未選擇 Template"
              description="請先選擇一個已儲存的 Template，或到 Templates 建立新 Template。"
              action={
                templates.templates.length > 0 ? (
                  <Select defaultValue="" onChange={(e) => e.target.value && void openTemplate(e.target.value, "merge")}>
                    <option value="">選擇 Template…</option>
                    {templates.templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                ) : (
                  <Button onClick={() => setView("templates")}>前往 Templates</Button>
                )
              }
            />
          )}
          {!sheet && (
            <>
              {excel.error && <Alert tone="error" title="Excel 無法使用">{excel.error}</Alert>}
              <EmptyState icon={<FileSpreadsheet className="h-6 w-6" />} title="尚未上載 Excel" description="請上載 .xlsx 檔案。" />
              <ExcelDropzone compact />
            </>
          )}
        </div>
      </div>
    );
  }

  const total = selectedRows.length;
  const individualTooMany = settings.output === "individual" && total > MAX_INDIVIDUAL_FILES;
  const canGenerate = !progress.running && errorCount === 0 && total > 0 && !individualTooMany;

  const onGenerate = async () => {
    const r = await confirm({
      title: "產生文件 / Generate Documents",
      description: (
        <span>
          將為 <b>{total.toLocaleString()}</b> 行資料產生 .docx 文件，
          {settings.output === "zip" ? "並打包成一個 ZIP 下載。" : "並逐一下載（個別檔案）。"}
          {issues.some((i) => i.level === "warning") && "（目前有警告，請確認已檢查。）"}
        </span>
      ),
      confirmText: `產生 ${total.toLocaleString()} 份文件`,
    });
    if (r !== "ok") return;
    const res = await merge.generate(draft, sheet, blankDefault);
    if (res.downloadError) toast({ type: "error", title: "下載失敗", description: res.downloadError });
    else if (res.failed.length > 0)
      toast({ type: "warning", title: "已完成，但部分文件失敗", description: `成功 ${res.success} · 失敗 ${res.failed.length} · 略過 ${res.skipped.length}` });
    else toast({ type: "success", title: "文件已產生 / Done", description: `成功 ${res.success} · 略過 ${res.skipped.length}` });
  };

  const toggleManual = (n: number) => {
    const s = new Set(settings.manual);
    if (s.has(n)) s.delete(n);
    else s.add(n);
    merge.update({ manual: Array.from(s) });
  };

  return (
    <div className="flex h-full min-h-0">
      {/* 左：設定 */}
      <aside className="w-80 shrink-0 space-y-5 overflow-y-auto border-r bg-card p-4">
        <Field label="Template">
          <Select value={draft.id} onChange={(e) => void openTemplate(e.target.value, "merge")}>
            {templates.templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>

        <div>
          <SectionTitle>資料範圍 Rows</SectionTitle>
          <div className="mb-3 grid grid-cols-2 gap-1">
            {ROW_MODES.map((m) => (
              <Button key={m.id} size="sm" variant="outline" active={settings.rowMode === m.id} onClick={() => merge.update({ rowMode: m.id })}>
                {m.label}
              </Button>
            ))}
          </div>
          {settings.rowMode === "range" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="由 Excel 行">
                <Input type="number" value={settings.rangeFrom} onChange={(e) => merge.update({ rangeFrom: Number(e.target.value) })} />
              </Field>
              <Field label="至 Excel 行">
                <Input type="number" value={settings.rangeTo} onChange={(e) => merge.update({ rangeTo: Number(e.target.value) })} />
              </Field>
            </div>
          )}
          {settings.rowMode === "manual" && (
            <div>
              <div className="mb-1 flex gap-1">
                <Button size="sm" variant="outline" onClick={() => merge.update({ manual: sheet.rows.map((r) => r.rowNumber) })}>全選</Button>
                <Button size="sm" variant="outline" onClick={() => merge.update({ manual: [] })}>全不選</Button>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border">
                {sheet.rows.map((r) => (
                  <label key={r.rowNumber} className="flex cursor-pointer items-center gap-2 border-b px-2 py-1 text-xs last:border-b-0 hover:bg-muted">
                    <Checkbox checked={settings.manual.includes(r.rowNumber)} onChange={() => toggleManual(r.rowNumber)} />
                    <span className="w-8 shrink-0 text-muted-foreground">{r.rowNumber}</span>
                    <span className="truncate">{r.cells.slice(0, 2).map((c) => c.d).join(" · ")}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {settings.rowMode === "filter" && (
            <div className="space-y-2">
              <Select value={settings.filterColumn} onChange={(e) => merge.update({ filterColumn: Number(e.target.value) })}>
                {sheet.columns.map((c) => (
                  <option key={c.index} value={c.index}>{c.letter} · {c.header}</option>
                ))}
              </Select>
              <div className="flex gap-2">
                <Select className="w-28" value={settings.filterOp} onChange={(e) => merge.update({ filterOp: e.target.value as "equals" | "contains" })}>
                  <option value="equals">等於</option>
                  <option value="contains">包含</option>
                </Select>
                <Input placeholder="值 Value" value={settings.filterValue} onChange={(e) => merge.update({ filterValue: e.target.value })} />
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            已選 <b className="text-foreground">{total.toLocaleString()}</b> / {sheet.rows.length.toLocaleString()} 行
          </p>
        </div>

        <div>
          <SectionTitle>輸出 Output</SectionTitle>
          <div className="space-y-2">
            <Select value={settings.output} onChange={(e) => merge.update({ output: e.target.value as "zip" | "individual" })}>
              <option value="zip">下載為 ZIP / Download as ZIP</option>
              <option value="individual">下載個別檔案（最多 {MAX_INDIVIDUAL_FILES} 份）</option>
            </Select>
            <Field label="檔名使用欄位 File name column" hint="空白會用 Document_001.docx；非法字元會自動移除；重複會加 -2、-3。">
              <Select value={settings.fileNameColumn} onChange={(e) => merge.update({ fileNameColumn: Number(e.target.value) })}>
                {sheet.columns.map((c) => (
                  <option key={c.index} value={c.index}>{c.letter} · {c.header}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </aside>

      {/* 中：預覽 */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
          <span className="text-sm font-semibold">預覽 Preview</span>
          <Select className="h-8 w-52 text-xs" value={settings.previewMode} onChange={(e) => merge.update({ previewMode: e.target.value as PreviewMode })}>
            <option value="first">第一筆 First row</option>
            <option value="single">選擇任一筆 Pick a row</option>
            <option value="first10">前 10 筆 First 10</option>
            <option value="all">所有已選資料 All selected</option>
          </Select>
          {settings.previewMode === "single" && (
            <Select
              className="h-8 w-52 text-xs"
              value={previewRows[0]?.rowNumber ?? ""}
              onChange={(e) => merge.update({ previewRow: Number(e.target.value) })}
            >
              {selectedRows.map((r) => (
                <option key={r.rowNumber} value={r.rowNumber}>第 {r.rowNumber} 行 · {r.cells[0]?.d.slice(0, 20)}</option>
              ))}
            </Select>
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox checked={!plain} onChange={() => setPlain((p) => !p)} /> 標示已填入的值
          </label>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            縮放
            <input type="range" min={40} max={120} step={5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            {zoom}%
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/70 p-6">
          {previewRows.length === 0 ? (
            <EmptyState title="沒有可預覽的資料" description="目前選擇的範圍內沒有任何資料行。請調整左側的資料範圍。" />
          ) : (
            <>
              <MergePreview template={draft} sheet={sheet} rows={previewRows} fileNames={fileNames} blankDefault={blankDefault} zoom={zoom} plain={plain} />
              {settings.previewMode === "all" && selectedRows.length > showCount && (
                <div className="mt-6 text-center">
                  <Button variant="outline" onClick={() => setShowCount((c) => c + 20)}>
                    再顯示 20 筆（已顯示 {showCount} / {selectedRows.length}）
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* 右：驗證及產生 */}
      <aside className="w-80 shrink-0 space-y-4 overflow-y-auto border-l bg-card p-4">
        <div className="space-y-3">
          <Button className="w-full justify-center" size="md" disabled={!canGenerate} onClick={() => void onGenerate()}>
            <Play className="h-4 w-4" /> 產生文件 / Generate Documents
          </Button>
          {errorCount > 0 && <p className="text-xs text-destructive">請先修正以下錯誤，才能產生文件。</p>}
          {individualTooMany && (
            <Alert tone="error" title={`個別檔案一次最多 ${MAX_INDIVIDUAL_FILES} 份`}>
              目前選了 {total} 行。請縮小資料範圍，或改用「下載為 ZIP」。
            </Alert>
          )}
          {progress.running && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                {progress.phase === "zip"
                  ? "正在打包 ZIP…"
                  : `Generating ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()} documents...`}
              </p>
              <ProgressBar value={progress.current} max={progress.total} />
            </div>
          )}
          {result && !progress.running && (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <Download className="h-4 w-4" /> 產生結果
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="success">成功 {result.success}</Badge>
                <Badge tone={result.failed.length ? "danger" : "default"}>失敗 {result.failed.length}</Badge>
                <Badge tone={result.skipped.length ? "warning" : "default"}>略過 {result.skipped.length}</Badge>
              </div>
              {result.downloadError && <Alert tone="error" title="下載失敗">{result.downloadError}</Alert>}
              {result.failed.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-destructive">
                  {result.failed.map((f) => (
                    <li key={f.rowNumber}>第 {f.rowNumber} 行：{f.message}</li>
                  ))}
                </ul>
              )}
              {result.skipped.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-warning">
                  {result.skipped.map((f) => (
                    <li key={f.rowNumber}>第 {f.rowNumber} 行：{f.message}</li>
                  ))}
                </ul>
              )}
              {!result.downloadError && result.success > 0 && (
                <p className="text-xs text-muted-foreground">
                  {result.output === "zip" ? "ZIP 已自動下載。" : "檔案已逐一下載。"}若沒有看到下載，請檢查瀏覽器是否封鎖了多個檔案下載。
                </p>
              )}
            </div>
          )}
        </div>
        <div>
          <SectionTitle>驗證 Validation</SectionTitle>
          <ValidationPanel issues={issues} hasExcel />
        </div>
        <p className={cn("text-[11px] text-muted-foreground")}>預覽及產生都使用目前編輯中的 Template（包括尚未儲存的修改）。</p>
      </aside>
    </div>
  );
}
