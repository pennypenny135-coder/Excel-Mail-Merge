"use client";

import { useState } from "react";
import { Download, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useApp } from "@/components/app-context";
import { ExportDialog } from "@/components/templates/export-dialog";
import { ImportDialog } from "@/components/templates/import-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Alert, Card } from "@/components/ui/misc";
import { FONT_FAMILIES, FONT_SIZES } from "@/lib/template";
import type { BlankMode, PageSize } from "@/types/template";

export function SettingsView() {
  const { prefs, updatePrefs, clearData } = useApp();
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold">設定 / Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">設定會自動儲存在此瀏覽器（IndexedDB）。新建立的 Template 會使用這些預設值。</p>
        </div>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">新 Template 預設值 / Defaults</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="預設紙張 Default page size">
              <Select value={prefs.defaultPageSize} onChange={(e) => updatePrefs({ defaultPageSize: e.target.value as PageSize })}>
                <option value="A4">A4</option>
                <option value="A5">A5</option>
                <option value="Letter">Letter</option>
              </Select>
            </Field>
            <Field label="預設方向 Orientation">
              <Select value={prefs.defaultOrientation} onChange={(e) => updatePrefs({ defaultOrientation: e.target.value as "portrait" | "landscape" })}>
                <option value="portrait">直向 Portrait</option>
                <option value="landscape">橫向 Landscape</option>
              </Select>
            </Field>
            <Field label="預設字體 Default font">
              <Select value={prefs.defaultFontFamily} onChange={(e) => updatePrefs({ defaultFontFamily: e.target.value })}>
                {FONT_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="預設字級 Default size (pt)">
              <Select value={prefs.defaultFontSize} onChange={(e) => updatePrefs({ defaultFontSize: Number(e.target.value) })}>
                {FONT_SIZES.map((n) => (
                  <option key={n} value={n}>{n} pt</option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">空白儲存格處理 / Blank cells</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="預設處理方式" hint="每個 placeholder 也可以個別覆寫。">
              <Select value={prefs.defaultBlankMode} onChange={(e) => updatePrefs({ defaultBlankMode: e.target.value as BlankMode })}>
                <option value="blank">留空 / Leave blank</option>
                <option value="custom">以自訂文字取代 / Replace with text</option>
                <option value="skip">略過此行並警告 / Skip row</option>
              </Select>
            </Field>
            {prefs.defaultBlankMode === "custom" && (
              <Field label="取代文字 Replacement text">
                <Input value={prefs.defaultBlankText} onChange={(e) => updatePrefs({ defaultBlankText: e.target.value })} placeholder="N/A" />
              </Field>
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">外觀 / Appearance</h2>
          <Field label="主題 Theme">
            <Select value={prefs.theme} onChange={(e) => updatePrefs({ theme: e.target.value as "light" | "dark" | "system" })}>
              <option value="system">跟隨系統 System</option>
              <option value="light">淺色 Light</option>
              <option value="dark">深色 Dark</option>
            </Select>
          </Field>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">匯出 / 匯入 Templates</h2>
          <p className="text-xs text-muted-foreground">建議定期匯出備份，尤其在清除瀏覽器資料或更換電腦之前。</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="h-4 w-4" /> 匯出 Export</Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> 匯入 Import</Button>
          </div>
        </Card>

        <Card className="space-y-3 border-destructive/40 p-5">
          <h2 className="text-sm font-semibold text-destructive">清除本機資料 / Clear local data</h2>
          <p className="text-xs text-muted-foreground">刪除此瀏覽器內所有 Templates、資料夾、設定及最近使用記錄，無法復原。</p>
          <Button variant="destructive" onClick={() => void clearData()}><Trash2 className="h-4 w-4" /> 清除所有本機資料</Button>
        </Card>

        <Alert tone="success" title="資料私隱 / Privacy">
          <span className="flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Excel、Template 及產生的文件全部只在你的瀏覽器處理，不會上傳到任何伺服器。完整 Excel 資料不會儲存，重新整理後需重新上載。
          </span>
        </Alert>
      </div>
      {exportOpen && <ExportDialog open onClose={() => setExportOpen(false)} />}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
