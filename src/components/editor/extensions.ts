import { Extension, Node as TiptapNode, mergeAttributes, nodeInputRule, nodePasteRule, type Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";

/* ------------------------------------------------------------------ */
/* Placeholder（Excel 欄位）節點：以 {{欄位名}} 顯示                      */
/* ------------------------------------------------------------------ */
export const MergeField = TiptapNode.create({
  name: "mergeField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-merge-field") ?? "",
        renderHTML: (attrs) => ({ "data-merge-field": attrs.name as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-merge-field]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes({ class: "merge-field" }, HTMLAttributes), `{{${node.attrs.name}}}`];
  },

  renderText({ node }) {
    return `{{${node.attrs.name}}}`;
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\{\{([^{}]+)\}\}$/,
        type: this.type,
        getAttributes: (match) => ({ name: String(match[1]).trim() }),
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: /\{\{([^{}]+)\}\}/g,
        type: this.type,
        getAttributes: (match) => ({ name: String(match[1]).trim() }),
      }),
    ];
  },
});

/* ------------------------------------------------------------------ */
/* 段落樣式：行距、縮排                                                  */
/* ------------------------------------------------------------------ */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphStyle: {
      setLineHeight: (value: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
  }
}

const INDENT_PT = 36;

function cssLengthToPt(v: string): number {
  const m = v.trim().match(/^(-?[\d.]+)(pt|px|in|cm|mm)?$/i);
  if (!m) return 0;
  const n = Number(m[1]);
  switch ((m[2] ?? "px").toLowerCase()) {
    case "pt": return n;
    case "px": return n * 0.75;
    case "in": return n * 72;
    case "cm": return (n / 2.54) * 72;
    case "mm": return (n / 25.4) * 72;
    default: return 0;
  }
}

export const ParagraphStyle = Extension.create({
  name: "paragraphStyle",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => {
              const v = el.style.lineHeight;
              if (!v || v === "normal") return null;
              if (v.endsWith("%")) return String(Math.round((parseFloat(v) / 100) * 100) / 100);
              return /^[\d.]+$/.test(v) ? v : null;
            },
            renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
          },
          indent: {
            default: 0,
            parseHTML: (el) => {
              const ml = el.style.marginLeft;
              if (!ml) return 0;
              return Math.max(0, Math.min(8, Math.round(cssLengthToPt(ml) / INDENT_PT)));
            },
            renderHTML: (attrs) =>
              attrs.indent ? { style: `margin-left: ${(attrs.indent as number) * INDENT_PT}pt` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (value: string) =>
        ({ chain }) =>
          chain()
            .updateAttributes("paragraph", { lineHeight: value })
            .updateAttributes("heading", { lineHeight: value })
            .run(),
      unsetLineHeight:
        () =>
        ({ chain }) =>
          chain()
            .updateAttributes("paragraph", { lineHeight: null })
            .updateAttributes("heading", { lineHeight: null })
            .run(),
      increaseIndent:
        () =>
        ({ editor, chain }) => {
          if (editor.isActive("listItem")) return editor.commands.sinkListItem("listItem");
          const node = editor.isActive("heading") ? "heading" : "paragraph";
          const cur = (editor.getAttributes(node).indent as number | undefined) ?? 0;
          const next = Math.min(8, cur + 1);
          return chain().updateAttributes("paragraph", { indent: next }).updateAttributes("heading", { indent: next }).run();
        },
      decreaseIndent:
        () =>
        ({ editor, chain }) => {
          if (editor.isActive("listItem")) return editor.commands.liftListItem("listItem");
          const node = editor.isActive("heading") ? "heading" : "paragraph";
          const cur = (editor.getAttributes(node).indent as number | undefined) ?? 0;
          const next = Math.max(0, cur - 1);
          return chain().updateAttributes("paragraph", { indent: next }).updateAttributes("heading", { indent: next }).run();
        },
    };
  },
});

export function createExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      code: false,
      codeBlock: false,
      link: false,
    }),
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    MergeField,
    ParagraphStyle,
  ];
}

/* ------------------------------------------------------------------ */
/* Placeholder 操作                                                     */
/* ------------------------------------------------------------------ */
export function insertFieldsAtCursor(editor: Editor | null, names: string[]) {
  if (!editor || names.length === 0) return;
  const content: Record<string, unknown>[] = [];
  names.forEach((n, i) => {
    if (i > 0) content.push({ type: "text", text: " " });
    content.push({ type: "mergeField", attrs: { name: n } });
  });
  editor.chain().focus().insertContent(content).run();
}

function findFields(editor: Editor, name?: string): { pos: number; size: number; name: string }[] {
  const out: { pos: number; size: number; name: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "mergeField" && (name === undefined || node.attrs.name === name)) {
      out.push({ pos, size: node.nodeSize, name: node.attrs.name as string });
    }
  });
  return out;
}

export function replaceField(editor: Editor, from: string, to: string) {
  const tr = editor.state.tr;
  findFields(editor, from).forEach(({ pos }) => {
    const node = editor.state.doc.nodeAt(pos);
    if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, name: to });
  });
  editor.view.dispatch(tr);
}

export function deleteFieldEverywhere(editor: Editor, name: string) {
  const tr = editor.state.tr;
  findFields(editor, name)
    .sort((a, b) => b.pos - a.pos)
    .forEach(({ pos, size }) => tr.delete(pos, pos + size));
  editor.view.dispatch(tr);
}

export function selectFirstField(editor: Editor, name: string) {
  const first = findFields(editor, name)[0];
  if (first) editor.chain().focus().setNodeSelection(first.pos).scrollIntoView().run();
}

/* ------------------------------------------------------------------ */
/* Word 貼上清理                                                        */
/* ------------------------------------------------------------------ */
const KEEP_STYLES = [
  "font-family",
  "font-size",
  "color",
  "background-color",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
  "line-height",
  "margin-left",
];

function normalizeStyle(el: HTMLElement) {
  const raw = el.getAttribute("style");
  if (!raw) return;
  const kept: string[] = [];
  const isPara = el.tagName === "P" || /^H[1-6]$/.test(el.tagName);
  for (const decl of raw.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    let val = decl.slice(idx + 1).trim();
    if (!val || !KEEP_STYLES.includes(prop)) continue;
    if (prop === "margin-left" && !isPara) continue;
    if (/mso-|windowtext|inherit|initial|minor-|major-/i.test(val)) continue;
    if (prop === "font-size") {
      const m = val.match(/^([\d.]+)(pt|px)$/i);
      if (!m) continue;
      const pt = m[2].toLowerCase() === "px" ? Number(m[1]) * 0.75 : Number(m[1]);
      val = `${Math.round(pt * 2) / 2}pt`;
    }
    if (prop === "color" && /^(#000000?|black|rgb\(0,\s*0,\s*0\))$/i.test(val)) continue;
    if (prop === "background-color" && /^(white|#fff(fff)?|transparent|rgb\(255,\s*255,\s*255\))$/i.test(val)) continue;
    if (prop === "text-align" && !/^(left|right|center|justify)$/i.test(val)) continue;
    if (prop === "font-family") val = val.replace(/&quot;/g, '"');
    kept.push(`${prop}: ${val}`);
  }
  if (kept.length) el.setAttribute("style", kept.join("; "));
  else el.removeAttribute("style");
}

function convertWordLists(doc: Document) {
  const isListP = (el: Element) =>
    el.tagName === "P" && /mso-list:\s*(?!none)[^;]*level\d+/i.test(el.getAttribute("style") ?? "");
  const kids = Array.from(doc.body.children);
  let i = 0;
  while (i < kids.length) {
    if (!isListP(kids[i])) {
      i++;
      continue;
    }
    const run: Element[] = [];
    while (i < kids.length && isListP(kids[i])) run.push(kids[i++]);
    const stack: { list: HTMLElement; level: number; id: string; ordered: boolean }[] = [];
    run[0].before(doc.createComment("list-anchor"));
    const anchor = run[0].previousSibling as ChildNode;
    let lastNode: ChildNode = anchor;
    for (const p of run) {
      const level = Number((p.getAttribute("style") ?? "").match(/level(\d+)/i)?.[1] ?? 1);
      const listId = (p.getAttribute("style") ?? "").match(/mso-list:\s*(l\d+)/i)?.[1] ?? "";
      const bulletEl = p.querySelector('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]');
      const bulletText = (bulletEl?.textContent ?? "").trim();
      const ordered = /^(\(?\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]/.test(bulletText);
      bulletEl?.remove();
      const li = doc.createElement("li");
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.level > level || (top.level === level && (top.id !== listId || top.ordered !== ordered))) stack.pop();
        else break;
      }
      if (!stack.length || stack[stack.length - 1].level < level) {
        const list = doc.createElement(ordered ? "ol" : "ul");
        if (stack.length) {
          const parentLi = stack[stack.length - 1].list.lastElementChild;
          (parentLi ?? stack[stack.length - 1].list).appendChild(list);
        } else {
          lastNode.after(list);
          lastNode = list;
        }
        stack.push({ list, level, id: listId, ordered });
      }
      p.removeAttribute("class");
      const ml = p.getAttribute("style");
      if (ml) p.setAttribute("style", ml.replace(/margin-left:[^;]+;?/gi, ""));
      li.appendChild(p);
      stack[stack.length - 1].list.appendChild(li);
    }
    anchor.remove();
  }
}

/** 清理由 Word（或其他來源）貼上的 HTML，只保留支援的格式 */
export function cleanWordHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style, meta, link, script, xml, title, head, colgroup, o\\:p").forEach((n) => {
    if (n.tagName.toLowerCase() === "o:p") n.replaceWith(...Array.from(n.childNodes));
    else n.remove();
  });
  // 移除註解（含 Word 條件註解）
  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));

  convertWordLists(doc);

  doc.body.querySelectorAll("*").forEach((node) => {
    const el = node as HTMLElement;
    if (el.tagName.toLowerCase().startsWith("o:") || el.tagName.toLowerCase().startsWith("w:")) {
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }
    el.removeAttribute("class");
    el.removeAttribute("lang");
    el.removeAttribute("id");
    el.removeAttribute("width");
    el.removeAttribute("height");
    el.removeAttribute("align");
    el.removeAttribute("valign");
    el.removeAttribute("cellpadding");
    el.removeAttribute("cellspacing");
    el.removeAttribute("border");
    normalizeStyle(el);
  });
  // 移除無用的空 span
  doc.body.querySelectorAll("span").forEach((s) => {
    if (!s.attributes.length) s.replaceWith(...Array.from(s.childNodes));
  });
  return doc.body.innerHTML;
}
