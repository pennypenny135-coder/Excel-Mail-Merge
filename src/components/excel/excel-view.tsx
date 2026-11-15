"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, RefreshCw, Table2, Columns3 } from "lucide-react";
import { useApp } from "@/components/app-context";
import { ExcelDropzone } from "@/components/excel/excel-dropzone";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Alert, Badge, Card, EmptyState } from "@/components/ui/misc";
import { TRUNCATE_WARNING } from "@/lib/excel";
import { COLUMN_TYPE_LABELS } from "@/lib/formatting";
import { extractPlaceholders } from "@/lib/template";
import type { ColumnType } from "@/types/excel";
import { cn } from "@/components/ui/utils";

const TYPE_TONE: Record<ColumnType, "default" | "primary" | "success" | "warning"> = {
  text: "default",
  number: "primary",
  currency: "success",
  percentage: "warning",
  date: "primary",
  empty: "default",
};

export function ExcelView() {
  const { excel, draft } = useApp();
  const [tab, setTab] = useState<"columns" | "data">("columns");
  const [headerInput, setHeaderInput] = useState<string | null>(null);
  const sheet = excel.sheet;

  const used = useMemo(
    () => new Set(draft ? extractPlaceholders(draft.content).map((p) => p.name) : []),
    [draft],
  );

  if (!excel.workbook) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div>
            <h1 className="text-xl font-semibold">Excel 資料 / Excel Data</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              上載 .xlsx 後，可選擇工作表、調整標題行，並檢視自動偵測的欄位類型。
            </p>
          </div>
          {excel.error && (
            <Alert tone="error" title="無法讀取 Excel">
              {excel.error}
            </Alert>
          )}
          <ExcelDropzone />
        </div>
      </div>
    );
  }

  const wb = excel.workbook;
  const headerValue = headerInput ?? String(excel.headerRow);
  const applyHeader = () => {
    const n = Number(headerValue);
    setHeaderInput(null);
    if (Number.isInteger(n) && n !== excel.headerRow) void excel.changeHeaderRow(n);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet className="h-8 w-8 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="max-w-[260px] truncate text-sm font-semibold">{wb.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {(wb.fileSize / 1024).toFixed(1)} KB · {sheet ? `${sheet.rows.length.toLocaleString()} 行資料 · ${sheet.columns.length} 欄` : "—"}
              </p>
            </div>
          </div>
          <div className="w-48">
            <Field label="工作表 Sheet">
              <Select value={excel.sheetName} onChange={(e) => void excel.selectSheet(e.target.value)} disabled={excel.loading}>
                {wb.sheetNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex items-end gap-2">
            <div className="w-28">
              <Field label="標題行 Header row">
                <Input
                  type="number"
                  min={1}
                  value={headerValue}
                  onChange={(e) => setHeaderInput(e.target.value)}
                  onBlur={applyHeader}
                  onKeyDown={(e) => e.key === "Enter" && applyHeader()}
                />
              </Field>
            </div>
            <Button variant="outline" onClick={() => void excel.selectSheet(excel.sheetName)} title="重新自動偵測標題行">
              <RefreshCw className="h-4 w-4" /> 自動偵測
            </Button>
          </div>
          <div className="ml-auto w-64">
            <ExcelDropzone compact />
          </div>
        </div>
        {excel.error && (
          <Alert tone="error" title="此工作表無法使用">
            {excel.error}
          </Alert>
        )}
        {sheet?.truncated && (
          <Alert tone="warning" title={TRUNCATE_WARNING}>
            只有首 1,000 行資料可用於 Mail Merge。如需處理更多資料，請將 Excel 拆分成多個檔案。
          </Alert>
        )}
        {sheet && excel.autoDetected && (
          <p className="text-xs text-muted-foreground">
            已自動偵測標題行為第 {sheet.headerRow} 行；資料由第 {sheet.headerRow + 1} 行開始，完全空白的行已自動忽略。
          </p>
        )}
      </div>

      {sheet ? (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex gap-1">
            <Button variant="ghost" active={tab === "columns"} onClick={() => setTab("columns")}>
              <Columns3 className="h-4 w-4" /> 欄位 Columns
            </Button>
            <Button variant="ghost" active={tab === "data"} onClick={() => setTab("data")}>
              <Table2 className="h-4 w-4" /> 資料預覽 Data preview
            </Button>
          </div>
          <Card className="min-h-0 flex-1 overflow-auto">
            {tab === "columns" ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-16 px-3 py-2">欄 Col</th>
                    <th className="px-3 py-2">標題 Header</th>
                    <th className="w-28 px-3 py-2">類型 Type</th>
                    <th className="px-3 py-2">範例值 Samples（前 5 筆）</th>
                    <th className="w-24 px-3 py-2">Template 使用</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.columns.map((c) => (
                    <tr key={c.index} className="border-t align-top">
                      <td className="px-3 py-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-semibold">{c.letter}</span>
                      </td>
                      <td className="px-3 py-2 font-medium">{c.header}</td>
                      <td className="px-3 py-2">
                        <Badge tone={TYPE_TONE[c.type]}>{COLUMN_TYPE_LABELS[c.type]}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {c.samples.length ? c.samples.map((s, i) => (
                          <span key={i} className="mr-1.5 inline-block max-w-[180px] truncate rounded bg-muted px-1.5 py-0.5 align-top">{s}</span>
                        )) : "—"}
                      </td>
                      <td className="px-3 py-2">{used.has(c.header) ? <Badge tone="success">已使用</Badge> : <span className="text-xs text-muted-foreground">未使用</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-max min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-left text-xs">
                  <tr>
                    <th className="sticky left-0 bg-muted px-3 py-2 text-muted-foreground">行</th>
                    {sheet.columns.map((c) => (
                      <th key={c.index} className="px-3 py-2 font-semibold whitespace-nowrap">
                        <span className="mr-1.5 text-muted-foreground">{c.letter}</span>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(0, 100).map((r) => (
                    <tr key={r.rowNumber} className="border-t">
                      <td className="sticky left-0 bg-card px-3 py-1.5 text-xs text-muted-foreground">{r.rowNumber}</td>
                      {r.cells.map((c, i) => (
                        <td key={i} className={cn("max-w-[260px] truncate px-3 py-1.5 whitespace-nowrap", c.t === "n" && "text-right tabular-nums")}>
                          {c.d}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {tab === "data" && sheet.rows.length > 100 && (
            <p className="mt-2 text-xs text-muted-foreground">只顯示前 100 行，共 {sheet.rows.length.toLocaleString()} 行。</p>
          )}
        </div>
      ) : (
        <div className="p-6">
          <EmptyState
            icon={<FileSpreadsheet className="h-6 w-6" />}
            title="請選擇有資料的工作表"
            description="從上方「Sheet」下拉選單選擇其他工作表，或調整標題行；也可以重新上載檔案。"
          />
        </div>
      )}
    </div>
  );
}
