"use client";

import { useState } from "react";
import { Crosshair, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-context";
import { deleteFieldEverywhere, replaceField, selectFirstField } from "@/components/editor/extensions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, Badge } from "@/components/ui/misc";
import { cn } from "@/components/ui/utils";
import {
  COLUMN_TYPE_LABELS,
  DEFAULT_PLACEHOLDER_SETTING,
  OUTPUT_FORMAT_LABELS,
} from "@/lib/formatting";
import { FONT_FAMILIES, FONT_SIZES, extractPlaceholders, folderPathLabel } from "@/lib/template";
import type { OutputFormat, PageSize, PlaceholderSetting } from "@/types/template";

type Tab = "placeholder" | "page" | "info";

export function RightPanel({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (n: string | null) => void;
}) {
  const [tab, setTab] = useState<Tab>("placeholder");
  const tabs: { id: Tab; label: string }[] = [
    { id: "placeholder", label: "Placeholder" },
    { id: "page", label: "頁面 Page" },
    { id: "info", label: "資訊 Info" },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 border-b p-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium",
              tab === t.id ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "placeholder" && <PlaceholderTab selected={selected} onSelect={onSelect} />}
        {tab === "page" && <PageTab />}
        {tab === "info" && <InfoTab />}
      </div>
    </div>
  );
}

function PlaceholderTab({ selected, onSelect }: { selected: string | null; onSelect: (n: string | null) => void }) {
  const { draft, excel, editorRef, updateDraft } = useApp();
  if (!draft) return null;
  const sheet = excel.sheet;
  const found = extractPlaceholders(draft.content);
  const setting: PlaceholderSetting = selected
    ? (draft.placeholders[selected] ?? DEFAULT_PLACEHOLDER_SETTING)
    : DEFAULT_PLACEHOLDER_SETTING;
  const col = selected ? sheet?.columns.find((c) => c.header === selected) : undefined;

  const patch = (p: Partial<PlaceholderSetting>) => {
    if (!selected) return;
    updateDraft({ placeholders: { ...draft.placeholders, [selected]: { ...setting, ...p } } });
  };

  const onReplace = (to: string) => {
    const ed = editorRef.current;
    if (!ed || !selected || !to || to === selected) return;
    replaceField(ed, selected, to);
    const ph = { ...draft.placeholders };
    if (ph[selected] && !ph[to]) ph[to] = ph[selected];
    delete ph[selected];
    updateDraft({ placeholders: ph });
    onSelect(to);
  };

  return (
    <div className="space-y-4">
      {selected ? (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-primary">{`{{${selected}}}`}</p>
            {col ? <Badge tone="success">欄 {col.letter}</Badge> : <Badge tone="danger">找不到欄位</Badge>}
          </div>
          {col ? (
            <p className="text-xs text-muted-foreground">
              對應 Excel 欄位：<b>{col.letter}</b> · {col.header} · {COLUMN_TYPE_LABELS[col.type]}
              {col.samples[0] ? ` · 例：${col.samples[0]}` : ""}
            </p>
          ) : (
            <Alert tone="error" title="Excel 中沒有此欄位">
              {sheet ? "請用下方「更換對應欄位」選擇現有欄位，或刪除此 placeholder。" : "請先上載 Excel 以驗證欄位。"}
            </Alert>
          )}
          {sheet && (
            <Field label="更換對應欄位 Replace column">
              <Select value="" onChange={(e) => onReplace(e.target.value)}>
                <option value="">選擇新的 Excel 欄位…</option>
                {sheet.columns.map((c) => (
                  <option key={c.index} value={c.header}>
                    {c.letter} · {c.header}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="輸出格式 Output format">
            <Select value={setting.format} onChange={(e) => patch({ format: e.target.value as OutputFormat })}>
              {(Object.keys(OUTPUT_FORMAT_LABELS) as OutputFormat[]).map((f) => (
                <option key={f} value={f}>{OUTPUT_FORMAT_LABELS[f]}</option>
              ))}
            </Select>
          </Field>
          {["number", "currency", "percentage"].includes(setting.format) && (
            <Field label="小數位數 Decimals（留空 = 自動）">
              <Input
                type="number"
                min={0}
                max={8}
                value={setting.decimals ?? ""}
                onChange={(e) => patch({ decimals: e.target.value === "" ? undefined : Math.max(0, Math.min(8, Number(e.target.value))) })}
              />
            </Field>
          )}
          {setting.format === "currency" && (
            <Field label="貨幣符號 Currency symbol">
              <Input value={setting.currencySymbol ?? "HK$"} onChange={(e) => patch({ currencySymbol: e.target.value })} />
            </Field>
          )}
          {setting.format === "customDate" && (
            <Field label="日期格式 Date format" hint="可用：YYYY、YY、MM、M、DD、D、HH、mm、ss">
              <Input value={setting.dateFormat ?? "DD/MM/YYYY"} onChange={(e) => patch({ dateFormat: e.target.value })} />
              <div className="mt-1 flex gap-1">
                {["DD/MM/YYYY", "YYYY-MM-DD", "D/M/YYYY"].map((f) => (
                  <Button key={f} size="sm" variant="outline" onClick={() => patch({ dateFormat: f })}>{f}</Button>
                ))}
              </div>
            </Field>
          )}
          <Field label="空白儲存格 Blank cell">
            <Select value={setting.blank} onChange={(e) => patch({ blank: e.target.value as PlaceholderSetting["blank"] })}>
              <option value="default">跟隨全域設定 / Use default</option>
              <option value="blank">留空 / Leave blank</option>
              <option value="custom">以自訂文字取代 / Replace with text</option>
              <option value="skip">略過此行並警告 / Skip row</option>
            </Select>
          </Field>
          {setting.blank === "custom" && (
            <Input placeholder="例如：N/A" value={setting.blankText ?? ""} onChange={(e) => patch({ blankText: e.target.value })} />
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => editorRef.current?.chain().focus().deleteSelection().run()}>
              <Trash2 className="h-3.5 w-3.5" /> 刪除此處
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (editorRef.current) deleteFieldEverywhere(editorRef.current, selected);
                onSelect(null);
              }}
            >
              刪除全部同名
            </Button>
          </div>
        </div>
      ) : (
        <Alert tone="info" title="尚未選取 Placeholder">
          在文件中點擊藍色的 {"{{欄位}}"} 標籤，即可查看對應欄位、更換欄位或設定輸出格式。
        </Alert>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">文件中的 Placeholders（{found.length}）</h4>
        {found.length === 0 ? (
          <p className="text-xs text-muted-foreground">文件內還沒有 placeholder。請由左側拖入 Excel 欄位。</p>
        ) : (
          <ul className="space-y-1">
            {found.map((p) => {
              const c = sheet?.columns.find((x) => x.header === p.name);
              const bad = sheet && !c;
              return (
                <li key={p.name}>
                  <button
                    onClick={() => {
                      if (editorRef.current) selectFirstField(editorRef.current, p.name);
                      onSelect(p.name);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs hover:bg-muted",
                      selected === p.name && "border-primary bg-accent",
                    )}
                  >
                    <Crosshair className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{`{{${p.name}}}`}</span>
                    {p.count > 1 && <Badge>×{p.count}</Badge>}
                    {c && <Badge tone="success">{c.letter}</Badge>}
                    {bad && <Badge tone="danger">缺少</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PageTab() {
  const { draft, updateDraft } = useApp();
  if (!draft) return null;
  const setMargin = (k: keyof typeof draft.margins, v: string) => {
    const n = Math.max(0, Math.min(80, Number(v) || 0));
    updateDraft({ margins: { ...draft.margins, [k]: n } });
  };
  return (
    <div className="space-y-4">
      <Field label="紙張大小 Page size">
        <Select value={draft.pageSize} onChange={(e) => updateDraft({ pageSize: e.target.value as PageSize })}>
          <option value="A4">A4 (210 × 297 mm)</option>
          <option value="A5">A5 (148 × 210 mm)</option>
          <option value="Letter">Letter (8.5 × 11 in)</option>
        </Select>
      </Field>
      <Field label="方向 Orientation">
        <Select value={draft.orientation} onChange={(e) => updateDraft({ orientation: e.target.value as "portrait" | "landscape" })}>
          <option value="portrait">直向 Portrait</option>
          <option value="landscape">橫向 Landscape</option>
        </Select>
      </Field>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">頁邊距 Margins (mm)</p>
        <div className="grid grid-cols-2 gap-2">
          {(["top", "bottom", "left", "right"] as const).map((k) => (
            <label key={k} className="text-xs text-muted-foreground">
              {{ top: "上 Top", bottom: "下 Bottom", left: "左 Left", right: "右 Right" }[k]}
              <Input type="number" min={0} max={80} step={0.5} value={draft.margins[k]} onChange={(e) => setMargin(k, e.target.value)} />
            </label>
          ))}
        </div>
      </div>
      <Field label="預設字體 Default font">
        <Select value={draft.fontFamily} onChange={(e) => updateDraft({ fontFamily: e.target.value })}>
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="預設字級 Default size (pt)">
        <Select value={draft.fontSize} onChange={(e) => updateDraft({ fontSize: Number(e.target.value) })}>
          {FONT_SIZES.map((n) => (
            <option key={n} value={n}>{n} pt</option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function InfoTab() {
  const { draft, updateDraft, templates } = useApp();
  if (!draft) return null;
  const options = templates.folders
    .map((f) => ({ id: f.id, label: folderPathLabel(templates.folders, f.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
  return (
    <div className="space-y-4">
      <Field label="Template 名稱 Name">
        <Input value={draft.name} onChange={(e) => updateDraft({ name: e.target.value })} />
      </Field>
      <Field label="說明 Description">
        <Textarea rows={3} value={draft.description} onChange={(e) => updateDraft({ description: e.target.value })} />
      </Field>
      <Field label="資料夾 Folder">
        <Select value={draft.folderId ?? ""} onChange={(e) => updateDraft({ folderId: e.target.value || null })}>
          <option value="">（根目錄 / Root）</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </Select>
      </Field>
      <dl className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between"><dt>建立 Created</dt><dd>{new Date(draft.createdAt).toLocaleString("zh-HK")}</dd></div>
        <div className="flex justify-between"><dt>更新 Updated</dt><dd>{new Date(draft.updatedAt).toLocaleString("zh-HK")}</dd></div>
        <div className="flex justify-between"><dt>版本 Version</dt><dd>{draft.version}</dd></div>
      </dl>
    </div>
  );
}
