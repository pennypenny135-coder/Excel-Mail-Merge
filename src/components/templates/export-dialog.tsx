"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { downloadBlob } from "@/hooks/useMailMerge";
import { folderPathLabel, getDescendantIds } from "@/lib/template";
import { exportTemplates } from "@/lib/transfer";

export function ExportDialog({
  open,
  onClose,
  initialSelected,
}: {
  open: boolean;
  onClose: () => void;
  initialSelected?: string[];
}) {
  const { templates, toast } = useApp();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected ?? []));
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const g = [
      { id: null as string | null, label: "（根目錄 / Root）", items: templates.templates.filter((t) => !t.folderId) },
      ...templates.folders.map((f) => ({
        id: f.id as string | null,
        label: folderPathLabel(templates.folders, f.id),
        items: templates.templates.filter((t) => t.folderId === f.id),
      })),
    ];
    return g.sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
  }, [templates.templates, templates.folders]);

  const subtreeIds = (folderId: string | null): string[] => {
    if (folderId === null) return templates.templates.filter((t) => !t.folderId).map((t) => t.id);
    const ids = new Set([folderId, ...getDescendantIds(templates.folders, folderId)]);
    return templates.templates.filter((t) => t.folderId && ids.has(t.folderId)).map((t) => t.id);
  };

  const toggleMany = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((i) => (on ? n.add(i) : n.delete(i)));
      return n;
    });

  const doExport = async () => {
    const chosen = templates.templates.filter((t) => selected.has(t.id));
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const blob = await exportTemplates(chosen, templates.folders);
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      downloadBlob(blob, `mail-merge-templates-${stamp}.zip`);
      toast({ type: "success", title: "匯出完成 / Exported", description: `已匯出 ${chosen.length} 個 Template。ZIP 內不含 Excel 資料。` });
      onClose();
    } catch (e) {
      toast({
        type: "error",
        title: "匯出失敗",
        description: `${e instanceof Error ? e.message : String(e)}。請減少選取數量後重試，或確認瀏覽器允許下載。`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="匯出 Templates / Export"
      description="選擇單一或多個 Template，或勾選整個資料夾。匯出為 .zip（含 templates.json、每個 template 的 JSON、manifest.json、README）。"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button disabled={selected.size === 0 || busy} onClick={() => void doExport()}>
            {busy ? <Spinner /> : <Download className="h-4 w-4" />} 匯出 {selected.size} 個 Template
          </Button>
        </>
      }
    >
      {templates.templates.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">目前沒有任何 Template 可以匯出。</p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleMany(templates.templates.map((t) => t.id), true)}>全選</Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>全不選</Button>
          </div>
          {groups
            .filter((g) => g.items.length > 0 || g.id !== null)
            .map((g) => {
              const sub = subtreeIds(g.id);
              const allOn = sub.length > 0 && sub.every((i) => selected.has(i));
              return (
                <div key={g.id ?? "root"} className="rounded-lg border">
                  <label className="flex cursor-pointer items-center gap-2 bg-muted/60 px-3 py-2 text-sm font-medium">
                    <Checkbox checked={allOn} disabled={sub.length === 0} onChange={() => toggleMany(sub, !allOn)} />
                    {g.label}
                    <span className="text-xs font-normal text-muted-foreground">
                      （{g.id === null ? "只含根目錄" : "含子資料夾"}共 {sub.length} 個）
                    </span>
                  </label>
                  {g.items.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 border-t px-3 py-1.5 pl-8 text-sm hover:bg-muted/40">
                      <Checkbox checked={selected.has(t.id)} onChange={() => toggleMany([t.id], !selected.has(t.id))} />
                      {t.name}
                    </label>
                  ))}
                </div>
              );
            })}
        </div>
      )}
    </Modal>
  );
}
