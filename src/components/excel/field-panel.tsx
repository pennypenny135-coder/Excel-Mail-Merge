"use client";

import { useMemo, useState } from "react";
import { GripVertical, Plus, Search } from "lucide-react";
import { useApp } from "@/components/app-context";
import { ExcelDropzone } from "@/components/excel/excel-dropzone";
import { insertFieldsAtCursor } from "@/components/editor/extensions";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { COLUMN_TYPE_LABELS } from "@/lib/formatting";
import { extractPlaceholders } from "@/lib/template";

export function FieldPanel() {
  const { excel, draft, editorRef } = useApp();
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const sheet = excel.sheet;

  const used = useMemo(
    () => new Set(draft ? extractPlaceholders(draft.content).map((p) => p.name) : []),
    [draft],
  );

  if (!sheet) {
    return (
      <div className="space-y-3 p-3">
        <h3 className="text-sm font-semibold">Excel 欄位 / Fields</h3>
        <p className="text-xs text-muted-foreground">上載 Excel 後，這裡會顯示所有欄位，可拖入文件。</p>
        <ExcelDropzone compact />
      </div>
    );
  }

  const list = sheet.columns.filter(
    (c) => !q.trim() || c.header.toLowerCase().includes(q.trim().toLowerCase()) || c.letter.toLowerCase() === q.trim().toLowerCase(),
  );

  const toggle = (h: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(h)) n.delete(h);
      else n.add(h);
      return n;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Excel 欄位 / Fields</h3>
          <Badge>{sheet.columns.length} 欄</Badge>
        </div>
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜尋欄位 / Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          將欄位拖入文件，或點「＋」插入游標位置。可勾選多個欄位一次插入。
        </p>
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-center"
          disabled={checked.size === 0}
          onClick={() => {
            insertFieldsAtCursor(editorRef.current, sheet.columns.filter((c) => checked.has(c.header)).map((c) => c.header));
            setChecked(new Set());
          }}
        >
          <Plus className="h-3.5 w-3.5" /> 插入已勾選欄位（{checked.size}）
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {list.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">找不到符合的欄位</p>}
        {list.map((c) => (
          <div
            key={c.index}
            draggable
            onDragStart={(e) => {
              const names = checked.has(c.header) && checked.size > 1
                ? sheet.columns.filter((x) => checked.has(x.header)).map((x) => x.header)
                : [c.header];
              e.dataTransfer.setData("application/x-merge-fields", JSON.stringify(names));
              e.dataTransfer.setData("text/plain", names.map((n) => `{{${n}}}`).join(" "));
              e.dataTransfer.effectAllowed = "copy";
            }}
            className="group flex cursor-grab items-center gap-1.5 rounded-lg border bg-card px-1.5 py-1.5 text-sm hover:border-primary/60 active:cursor-grabbing"
            title={`拖入文件：{{${c.header}}}`}
          >
            <Checkbox checked={checked.has(c.header)} onChange={() => toggle(c.header)} aria-label={`選取 ${c.header}`} />
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold">{c.letter}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{c.header}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {COLUMN_TYPE_LABELS[c.type]}
                {c.samples[0] ? ` · ${c.samples[0]}` : ""}
              </p>
            </div>
            {used.has(c.header) && <span className="h-2 w-2 shrink-0 rounded-full bg-success" title="已用於 template" />}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="插入到游標位置 / Insert"
              onClick={() => insertFieldsAtCursor(editorRef.current, [c.header])}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
