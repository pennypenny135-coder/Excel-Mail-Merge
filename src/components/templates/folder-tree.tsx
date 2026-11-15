"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Folder as FolderIcon, FolderInput, FolderPlus, Layers, Pencil, Trash2 } from "lucide-react";
import type { Folder, Template } from "@/types/template";
import { MAX_FOLDER_DEPTH, getDescendantIds } from "@/lib/template";
import { cn } from "@/components/ui/utils";

export const SEL_ALL = "__all__";
export const SEL_ROOT = "__root__";

interface Props {
  folders: Folder[];
  templates: Template[];
  selected: string;
  onSelect: (id: string) => void;
  onCreate: (parentId: string | null) => void;
  onRename: (id: string) => void;
  onMove: (id: string) => void;
  onDelete: (id: string) => void;
}

export function FolderTree({ folders, templates, selected, onSelect, onCreate, onRename, onMove, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const count = (id: string) => {
    const ids = new Set([id, ...getDescendantIds(folders, id)]);
    return templates.filter((t) => t.folderId && ids.has(t.folderId)).length;
  };

  const renderLevel = (parentId: string | null, depth: number) => {
    const kids = folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    return kids.map((f) => {
      const hasKids = folders.some((x) => x.parentId === f.id);
      const open = !collapsed.has(f.id);
      return (
        <div key={f.id}>
          <div
            className={cn(
              "group flex items-center gap-1 rounded-md py-1 pr-1 text-sm hover:bg-muted",
              selected === f.id && "bg-accent text-primary",
            )}
            style={{ paddingLeft: 4 + depth * 14 }}
          >
            <button className="flex h-5 w-5 items-center justify-center text-muted-foreground" onClick={() => toggle(f.id)} aria-label={open ? "摺疊" : "展開"}>
              {hasKids ? open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" /> : null}
            </button>
            <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => onSelect(f.id)}>
              <FolderIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{f.name}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{count(f.id)}</span>
            </button>
            <span className="hidden items-center group-hover:flex">
              {depth + 1 < MAX_FOLDER_DEPTH && (
                <IconBtn title="新增子資料夾" onClick={() => onCreate(f.id)}><FolderPlus className="h-3.5 w-3.5" /></IconBtn>
              )}
              <IconBtn title="重新命名" onClick={() => onRename(f.id)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn title="移動" onClick={() => onMove(f.id)}><FolderInput className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn title="刪除" onClick={() => onDelete(f.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></IconBtn>
            </span>
          </div>
          {hasKids && open && renderLevel(f.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="space-y-0.5">
      <button
        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted", selected === SEL_ALL && "bg-accent text-primary")}
        onClick={() => onSelect(SEL_ALL)}
      >
        <Layers className="h-4 w-4" /> 全部 All
        <span className="ml-auto text-[11px] text-muted-foreground">{templates.length}</span>
      </button>
      <button
        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted", selected === SEL_ROOT && "bg-accent text-primary")}
        onClick={() => onSelect(SEL_ROOT)}
      >
        <FolderIcon className="h-4 w-4" /> 根目錄 Root
        <span className="ml-auto text-[11px] text-muted-foreground">{templates.filter((t) => !t.folderId).length}</span>
      </button>
      {renderLevel(null, 0)}
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className="flex h-6 w-6 items-center justify-center rounded hover:bg-border">
      {children}
    </button>
  );
}
