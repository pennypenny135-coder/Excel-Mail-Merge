"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useApp } from "@/components/app-context";
import { Toolbar } from "@/components/editor/toolbar";
import { cleanWordHtml, createExtensions } from "@/components/editor/extensions";
import { Spinner } from "@/components/ui/misc";
import { pageDimensionsMm } from "@/lib/template";

interface Props {
  zoom: number;
  onSelectField: (name: string | null) => void;
}

function RichEditorInner({ zoom, onSelectField }: Props) {
  const { draft, updateDraft, editorRef } = useApp();

  const extensions = useMemo(() => createExtensions(), []);
  const [initialContent] = useState(() => draft?.content ?? "");
  const editorProps = useMemo(
    () => ({
      attributes: { class: "doc-content", spellcheck: "false" },
      transformPastedHTML: cleanWordHtml,
      handleDrop: (view: EditorView, event: DragEvent) => {
        const raw = event.dataTransfer?.getData("application/x-merge-fields");
        if (!raw) return false;
        let names: string[];
        try {
          names = JSON.parse(raw) as string[];
        } catch {
          return false;
        }
        if (!Array.isArray(names) || names.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        let pos = coords?.pos ?? view.state.selection.from;
        const { schema } = view.state;
        const tr = view.state.tr;
        names.forEach((n, i) => {
          if (i > 0) {
            tr.insert(pos, schema.text(" "));
            pos += 1;
          }
          const node = schema.nodes.mergeField.create({ name: n });
          tr.insert(pos, node);
          pos += node.nodeSize;
        });
        view.dispatch(tr);
        view.focus();
        return true;
      },
    }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialContent,
    editorProps,
    onUpdate: ({ editor: e }) => {
      updateDraft({ content: e.getHTML() });
    },
    onSelectionUpdate: ({ editor: e }) => {
      const sel = e.state.selection;
      if (sel instanceof NodeSelection && sel.node.type.name === "mergeField") {
        onSelectField(sel.node.attrs.name as string);
      } else {
        onSelectField(null);
      }
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  if (!draft) return null;
  if (!editor) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> 載入編輯器…
      </div>
    );
  }
  const dim = pageDimensionsMm(draft.pageSize, draft.orientation);
  const m = draft.margins;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar editor={editor} defaultFont={draft.fontFamily} defaultSize={draft.fontSize} />
      <div className="min-h-0 flex-1 overflow-auto bg-muted/70 p-6">
        <div style={{ zoom: zoom / 100 }}>
          <div
            className="paper mx-auto"
            style={{
              width: `${dim.w}mm`,
              minHeight: `${dim.h}mm`,
              padding: `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`,
              fontFamily: `"${draft.fontFamily}", "Microsoft JhengHei", sans-serif`,
              fontSize: `${draft.fontSize}pt`,
            }}
          >
            <EditorContent editor={editor} className="[&_.ProseMirror]:min-h-[120mm]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export const RichEditor = memo(RichEditorInner);
