"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Minus,
  RemoveFormatting,
  Redo2,
  Strikethrough,
  Table2,
  Type,
  Underline,
  Undo2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ColorPicker } from "@/components/editor/color-picker";
import { FONT_FAMILIES, FONT_SIZES, primaryFontName } from "@/lib/template";

function Sep() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}

function Tb({
  title,
  onClick,
  active,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button variant="ghost" size="icon" title={title} aria-label={title} active={active} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

export function Toolbar({ editor, defaultFont, defaultSize }: { editor: Editor; defaultFont: string; defaultSize: number }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes("textStyle") as Record<string, string | undefined>;
      const block = e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "p";
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        fontFamily: ts.fontFamily ? primaryFontName(ts.fontFamily) : "",
        fontSize: ts.fontSize ?? "",
        color: ts.color ?? "",
        highlight: (e.getAttributes("highlight").color as string | undefined) ?? "",
        align: (["left", "center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
        lineHeight: (e.getAttributes(e.isActive("heading") ? "heading" : "paragraph").lineHeight as string | null) ?? "",
        block,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        inTable: e.isActive("table"),
      };
    },
  });

  const chain = () => editor.chain().focus();
  const sizeNum = s.fontSize ? parseFloat(s.fontSize) : NaN;
  const sizeOptions = !Number.isNaN(sizeNum) && !FONT_SIZES.includes(sizeNum) ? [...FONT_SIZES, sizeNum].sort((a, b) => a - b) : FONT_SIZES;
  const knownFamily = FONT_FAMILIES.some((f) => f.value === s.fontFamily);

  return (
    <div className="shrink-0 border-b bg-card">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
        <Tb title="復原 Undo (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!s.canUndo}><Undo2 className="h-4 w-4" /></Tb>
        <Tb title="重做 Redo (Ctrl+Y)" onClick={() => chain().redo().run()} disabled={!s.canRedo}><Redo2 className="h-4 w-4" /></Tb>
        <Sep />
        <Select
          className="h-8 w-24 text-xs"
          title="段落樣式 Style"
          value={s.block}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") chain().setParagraph().run();
            else chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
          }}
        >
          <option value="p">內文</option>
          <option value="h1">標題 1</option>
          <option value="h2">標題 2</option>
          <option value="h3">標題 3</option>
        </Select>
        <Select
          className="h-8 w-44 text-xs"
          title="字體 Font family"
          value={s.fontFamily}
          onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}
        >
          <option value="">預設（{defaultFont}）</option>
          {!knownFamily && s.fontFamily && <option value={s.fontFamily}>{s.fontFamily}</option>}
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Select>
        <Select
          className="h-8 w-20 text-xs"
          title="字級 Font size (pt)"
          value={Number.isNaN(sizeNum) ? "" : String(sizeNum)}
          onChange={(e) => (e.target.value ? chain().setFontSize(`${e.target.value}pt`).run() : chain().unsetFontSize().run())}
        >
          <option value="">{defaultSize} pt</option>
          {sizeOptions.map((n) => (
            <option key={n} value={n}>{n} pt</option>
          ))}
        </Select>
        <Sep />
        <Tb title="粗體 Bold (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()}><Bold className="h-4 w-4" /></Tb>
        <Tb title="斜體 Italic (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}><Italic className="h-4 w-4" /></Tb>
        <Tb title="底線 Underline (Ctrl+U)" active={s.underline} onClick={() => chain().toggleUnderline().run()}><Underline className="h-4 w-4" /></Tb>
        <Tb title="刪除線 Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Tb>
        <ColorPicker
          icon={<Type className="h-4 w-4" />}
          title="文字顏色 Text colour"
          value={s.color}
          onPick={(c) => chain().setColor(c).run()}
          onClear={() => chain().unsetColor().run()}
        />
        <ColorPicker
          icon={<Highlighter className="h-4 w-4" />}
          title="醒目提示 Highlight"
          value={s.highlight}
          onPick={(c) => chain().setHighlight({ color: c }).run()}
          onClear={() => chain().unsetHighlight().run()}
        />
        <Sep />
        <Tb title="靠左 Left" active={s.align === "left"} onClick={() => chain().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Tb>
        <Tb title="置中 Center" active={s.align === "center"} onClick={() => chain().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Tb>
        <Tb title="靠右 Right" active={s.align === "right"} onClick={() => chain().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Tb>
        <Tb title="左右對齊 Justify" active={s.align === "justify"} onClick={() => chain().setTextAlign("justify").run()}><AlignJustify className="h-4 w-4" /></Tb>
        <Select
          className="h-8 w-20 text-xs"
          title="行距 Line spacing"
          value={s.lineHeight}
          onChange={(e) => (e.target.value ? chain().setLineHeight(e.target.value).run() : chain().unsetLineHeight().run())}
        >
          <option value="">行距</option>
          {["1", "1.15", "1.5", "2", "2.5", "3"].map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>
        <Sep />
        <Tb title="項目符號 Bullet list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}><List className="h-4 w-4" /></Tb>
        <Tb title="編號清單 Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Tb>
        <Tb title="減少縮排 Outdent" onClick={() => chain().decreaseIndent().run()}><IndentDecrease className="h-4 w-4" /></Tb>
        <Tb title="增加縮排 Indent" onClick={() => chain().increaseIndent().run()}><IndentIncrease className="h-4 w-4" /></Tb>
        <Sep />
        <Tb title="插入表格 Insert table (3×3)" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></Tb>
        <Tb title="插入分隔線 Horizontal rule" onClick={() => chain().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Tb>
        <Tb
          title="清除格式 Clear formatting"
          onClick={() =>
            chain().unsetAllMarks().clearNodes().unsetTextAlign().unsetLineHeight().updateAttributes("paragraph", { indent: 0 }).run()
          }
        >
          <RemoveFormatting className="h-4 w-4" />
        </Tb>
      </div>
      {s.inTable && (
        <div className="flex flex-wrap items-center gap-1 border-t bg-muted/50 px-2 py-1 text-xs">
          <span className="mr-1 text-muted-foreground">表格 Table：</span>
          <Button size="sm" variant="outline" onClick={() => chain().addRowBefore().run()}>上方加列</Button>
          <Button size="sm" variant="outline" onClick={() => chain().addRowAfter().run()}>下方加列</Button>
          <Button size="sm" variant="outline" onClick={() => chain().addColumnBefore().run()}>左方加欄</Button>
          <Button size="sm" variant="outline" onClick={() => chain().addColumnAfter().run()}>右方加欄</Button>
          <Button size="sm" variant="outline" onClick={() => chain().deleteRow().run()}>刪除列</Button>
          <Button size="sm" variant="outline" onClick={() => chain().deleteColumn().run()}>刪除欄</Button>
          <Button size="sm" variant="outline" onClick={() => chain().mergeCells().run()}>合併儲存格</Button>
          <Button size="sm" variant="outline" onClick={() => chain().splitCell().run()}>分割儲存格</Button>
          <Button size="sm" variant="outline" onClick={() => chain().toggleHeaderRow().run()}>標題列</Button>
          <Button size="sm" variant="destructive" onClick={() => chain().deleteTable().run()}><Trash2 className="h-3.5 w-3.5" />刪除表格</Button>
        </div>
      )}
    </div>
  );
}
