"use client";

import { useState } from "react";
import { FilePlus2, FileText } from "lucide-react";
import { useApp } from "@/components/app-context";
import { FieldPanel } from "@/components/excel/field-panel";
import { RichEditor } from "@/components/editor/rich-editor";
import { RightPanel } from "@/components/editor/right-panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";

export function EditorView() {
  const { draft, templates, createTemplate, openTemplate } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(90);

  if (!draft) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="尚未開啟 Template"
            description="建立新的 Template，或從已儲存的 Templates 中選擇一個來編輯。"
            action={
              <Button onClick={() => void createTemplate(null)}>
                <FilePlus2 className="h-4 w-4" /> 建立 Template / Create Template
              </Button>
            }
          />
          {templates.templates.length > 0 && (
            <Select defaultValue="" onChange={(e) => e.target.value && void openTemplate(e.target.value)}>
              <option value="">開啟現有 Template / Open existing…</option>
              {templates.templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
        <FieldPanel />
      </aside>
      <section className="relative flex min-w-0 flex-1 flex-col">
        <RichEditor key={draft.id} zoom={zoom} onSelectField={setSelected} />
        <div className="absolute right-4 bottom-3 flex items-center gap-2 rounded-lg border bg-card px-2 py-1 text-xs shadow">
          縮放 Zoom
          <input type="range" min={50} max={130} step={5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          <span className="w-8 text-right">{zoom}%</span>
        </div>
      </section>
      <aside className="hidden w-80 shrink-0 border-l bg-card lg:block">
        <RightPanel selected={selected} onSelect={setSelected} />
      </aside>
    </div>
  );
}
