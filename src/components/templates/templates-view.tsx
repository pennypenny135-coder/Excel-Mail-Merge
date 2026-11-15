"use client";

import { useMemo, useState } from "react";
import { Copy, Download, FilePlus2, FolderInput, FolderPlus, FileText, Mail, PenLine, Search, Trash2, Upload } from "lucide-react";
import { useApp } from "@/components/app-context";
import { ExportDialog } from "@/components/templates/export-dialog";
import { ImportDialog } from "@/components/templates/import-dialog";
import { FolderTree, SEL_ALL, SEL_ROOT } from "@/components/templates/folder-tree";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/misc";
import {
  MAX_FOLDER_DEPTH,
  extractPlaceholders,
  folderPathLabel,
  getDescendantIds,
  getFolderDepth,
  getSubtreeHeight,
} from "@/lib/template";

type MoveTarget = { kind: "template" | "folder"; id: string } | null;

export function TemplatesView() {
  const app = useApp();
  const { templates, draft } = app;
  const [selected, setSelected] = useState<string>(SEL_ALL);
  const [q, setQ] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportInit, setExportInit] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [move, setMove] = useState<MoveTarget>(null);
  const [moveDest, setMoveDest] = useState<string>("");

  const visible = useMemo(() => {
    let list = templates.templates;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(s));
    } else if (selected === SEL_ROOT) list = list.filter((t) => !t.folderId);
    else if (selected !== SEL_ALL) list = list.filter((t) => t.folderId === selected);
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [templates.templates, selected, q]);

  const currentFolderId = selected === SEL_ALL || selected === SEL_ROOT ? null : selected;

  const err = (msg: string | null) => msg && app.toast({ type: "error", title: "操作失敗", description: msg });

  const newFolder = async (parentId: string | null) => {
    const name = await app.prompt({ title: "新增資料夾 / New folder", label: "資料夾名稱（最多三層）" });
    if (name === null) return;
    err(await templates.createFolder(name, parentId));
  };
  const renameFolder = async (id: string) => {
    const f = templates.folders.find((x) => x.id === id);
    const name = await app.prompt({ title: "重新命名資料夾 / Rename", label: "新名稱", initial: f?.name });
    if (name === null) return;
    err(await templates.renameFolder(id, name));
  };
  const deleteFolder = async (id: string) => {
    const f = templates.folders.find((x) => x.id === id);
    if (!f) return;
    const ids = new Set([id, ...getDescendantIds(templates.folders, id)]);
    const tcount = templates.templates.filter((t) => t.folderId && ids.has(t.folderId)).length;
    const subCount = ids.size - 1;
    const r = await app.confirm({
      title: "刪除資料夾 / Delete folder",
      description:
        tcount > 0
          ? `資料夾「${f.name}」內仍有 ${tcount} 個 Template${subCount ? `及 ${subCount} 個子資料夾` : ""}。你可以連同 Templates 一併刪除，或先將它們移到根目錄。`
          : `確定要刪除資料夾「${f.name}」${subCount ? `（含 ${subCount} 個子資料夾）` : ""}嗎？`,
      confirmText: tcount > 0 ? "連同 Templates 一併刪除" : "刪除",
      extraText: tcount > 0 ? "移到根目錄後刪除資料夾" : undefined,
      danger: true,
    });
    if (r === "cancel") return;
    if (await templates.deleteFolder(id, r === "extra" ? "move" : "delete")) {
      if (selected === id || ids.has(selected)) setSelected(SEL_ALL);
      if (draft && draft.folderId && ids.has(draft.folderId) && r === "ok") {
        app.toast({ type: "warning", title: "目前編輯的 Template 已隨資料夾刪除", description: "如需保留，請按「儲存」重新儲存。" });
      }
      app.toast({ type: "success", title: `已刪除資料夾「${f.name}」` });
    }
  };

  const openMove = (kind: "template" | "folder", id: string) => {
    setMove({ kind, id });
    const cur =
      kind === "template"
        ? templates.templates.find((t) => t.id === id)?.folderId
        : templates.folders.find((f) => f.id === id)?.parentId;
    setMoveDest(cur ?? "");
  };

  const moveOptions = useMemo(() => {
    if (!move) return [];
    return templates.folders
      .filter((f) => {
        if (move.kind === "template") return true;
        if (f.id === move.id || getDescendantIds(templates.folders, move.id).includes(f.id)) return false;
        return getFolderDepth(templates.folders, f.id) + getSubtreeHeight(templates.folders, move.id) <= MAX_FOLDER_DEPTH;
      })
      .map((f) => ({ id: f.id, label: folderPathLabel(templates.folders, f.id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
  }, [move, templates.folders]);

  const doMove = async () => {
    if (!move) return;
    const dest = moveDest || null;
    if (move.kind === "template") {
      if (await templates.moveTemplate(move.id, dest)) {
        if (draft?.id === move.id) app.updateDraft({ folderId: dest });
        app.toast({ type: "success", title: "已移動 Template" });
      }
    } else {
      const e = await templates.moveFolder(move.id, dest);
      if (e) {
        err(e);
        return;
      }
      app.toast({ type: "success", title: "已移動資料夾" });
    }
    setMove(null);
  };

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="text-sm font-semibold">資料夾 Folders</h2>
          <Button size="sm" variant="outline" onClick={() => void newFolder(null)}>
            <FolderPlus className="h-3.5 w-3.5" /> 新增
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <FolderTree
            folders={templates.folders}
            templates={templates.templates}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              setQ("");
            }}
            onCreate={(p) => void newFolder(p)}
            onRename={(id) => void renameFolder(id)}
            onMove={(id) => openMove("folder", id)}
            onDelete={(id) => void deleteFolder(id)}
          />
        </div>
        <p className="border-t p-3 text-[11px] text-muted-foreground">資料夾最多三層，例如：客戶信件 / 催收 / 逾期 30 日。滑鼠移到資料夾上可新增子資料夾、重新命名、移動或刪除。</p>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card p-3">
          <div className="relative w-64">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="搜尋 Template 名稱 / Search" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> 匯入 Import</Button>
            <Button
              variant="outline"
              onClick={() => {
                setExportInit([]);
                setExportOpen(true);
              }}
            >
              <Download className="h-4 w-4" /> 匯出 Export
            </Button>
            <Button onClick={() => void app.createTemplate(currentFolderId)}><FilePlus2 className="h-4 w-4" /> 建立 Template</Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!templates.loaded ? null : visible.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={q ? "找不到符合的 Template" : "這裡還沒有 Template"}
              description={q ? "請試試其他關鍵字。" : "按「建立 Template」開始，或匯入之前匯出的 .zip。"}
              action={!q ? <Button onClick={() => void app.createTemplate(currentFolderId)}><FilePlus2 className="h-4 w-4" /> 建立 Template / Create Template</Button> : undefined}
            />
          ) : (
            <ul className="space-y-2">
              {visible.map((t) => {
                const ph = extractPlaceholders(t.content).length;
                const isDraft = draft?.id === t.id;
                return (
                  <li key={t.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary/50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button className="truncate text-sm font-semibold hover:underline" onClick={() => void app.openTemplate(t.id)}>{t.name}</button>
                        {isDraft && app.dirty && <Badge tone="warning">未儲存</Badge>}
                        <Badge>{t.pageSize} · {t.orientation === "portrait" ? "直向" : "橫向"}</Badge>
                        <Badge tone={ph ? "primary" : "default"}>{ph} placeholders</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {folderPathLabel(templates.folders, t.folderId)} · 更新於 {new Date(t.updatedAt).toLocaleString("zh-HK")} · v{t.version}
                      </p>
                      {t.description && <p className="truncate text-xs text-muted-foreground">{t.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="outline" onClick={() => void app.openTemplate(t.id)}><PenLine className="h-3.5 w-3.5" /> 編輯</Button>
                      <Button size="sm" variant="outline" onClick={() => void app.openTemplate(t.id, "merge")} title="用此 Template 進行 Mail Merge"><Mail className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" title="複製 Duplicate" onClick={() => void app.duplicateTemplate(t.id)}><Copy className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="移動 Move" onClick={() => openMove("template", t.id)}><FolderInput className="h-4 w-4" /></Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="匯出 Export"
                        onClick={() => {
                          setExportInit([t.id]);
                          setExportOpen(true);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="刪除 Delete" onClick={() => void app.removeTemplate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <Modal
        open={!!move}
        onClose={() => setMove(null)}
        title={move?.kind === "folder" ? "移動資料夾 / Move folder" : "移動 Template / Move"}
        description="選擇目標位置（資料夾最多三層）。"
        footer={
          <>
            <Button variant="outline" onClick={() => setMove(null)}>取消</Button>
            <Button onClick={() => void doMove()}>移動</Button>
          </>
        }
      >
        <Select value={moveDest} onChange={(e) => setMoveDest(e.target.value)}>
          <option value="">（根目錄 / Root）</option>
          {moveOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </Select>
      </Modal>

      {exportOpen && <ExportDialog key={exportInit.join(",")} open onClose={() => setExportOpen(false)} initialSelected={exportInit} />}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
