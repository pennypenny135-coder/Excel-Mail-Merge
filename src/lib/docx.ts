import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  LineRuleType,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  type ILevelsOptions,
} from "docx";
import type { Template } from "@/types/template";
import { PAGE_MM, primaryFontName } from "@/lib/template";

type Block = Paragraph | Table;

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  font?: string;
  size?: number;
  highlight?: string;
}

interface Ctx {
  numbering: { reference: string; levels: ILevelsOptions[] }[];
  olCount: number;
  contentWidth: number;
  inTable: boolean;
  defaultPt: number;
}

interface ParaOpts {
  list?: { reference: string; level: number };
  indentLeft?: number;
  baseStyle?: RunStyle;
}

const mmToTwip = (mm: number) => Math.round(mm * 56.6929);
const BLOCK_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "hr", "div", "blockquote", "pre",
]);
const NAMED_COLORS: Record<string, string> = {
  black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF",
  yellow: "FFFF00", orange: "FFA500", purple: "800080", gray: "808080", grey: "808080",
};

function parseColor(css: string | null | undefined): string | undefined {
  if (!css) return undefined;
  const s = css.trim().toLowerCase();
  if (!s || s === "inherit" || s === "transparent" || s === "initial") return undefined;
  let m = s.match(/^#([0-9a-f]{6})$/);
  if (m) return m[1].toUpperCase();
  m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (m) return `${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase();
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) {
    return [m[1], m[2], m[3]]
      .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return NAMED_COLORS[s];
}

/** CSS 長度 → pt */
function lengthToPt(css: string, basePt: number): number | undefined {
  const m = css.trim().match(/^(-?[\d.]+)\s*(pt|px|em|rem|in|cm|mm)?$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  switch ((m[2] ?? "px").toLowerCase()) {
    case "pt": return n;
    case "px": return n * 0.75;
    case "em":
    case "rem": return n * basePt;
    case "in": return n * 72;
    case "cm": return (n / 2.54) * 72;
    case "mm": return (n / 25.4) * 72;
    default: return undefined;
  }
}

function cleanText(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function applyCss(el: HTMLElement, base: RunStyle, ctx: Ctx): RunStyle {
  const st = { ...base };
  const css = el.style;
  if (!css || css.length === 0) return st;
  if (css.fontFamily) st.font = primaryFontName(css.fontFamily);
  if (css.fontSize) {
    const pt = lengthToPt(css.fontSize, ctx.defaultPt);
    if (pt && pt > 0) st.size = Math.round(pt * 2);
  }
  const color = parseColor(css.color);
  if (color) st.color = color;
  const bg = parseColor(css.backgroundColor);
  if (bg) st.highlight = bg;
  if (css.fontWeight === "bold" || Number(css.fontWeight) >= 600) st.bold = true;
  if (css.fontStyle === "italic") st.italics = true;
  const deco = css.textDecorationLine || css.textDecoration || "";
  if (deco.includes("underline")) st.underline = true;
  if (deco.includes("line-through")) st.strike = true;
  return st;
}

function makeRun(text: string, st: RunStyle, brk = false): TextRun {
  return new TextRun({
    text: brk ? undefined : cleanText(text),
    break: brk ? 1 : undefined,
    bold: st.bold,
    italics: st.italics,
    underline: st.underline ? { type: UnderlineType.SINGLE } : undefined,
    strike: st.strike,
    color: st.color,
    font: st.font,
    size: st.size,
    shading: st.highlight
      ? { type: ShadingType.CLEAR, fill: st.highlight, color: "auto" }
      : undefined,
  });
}

function inlineRuns(node: Node, style: RunStyle, ctx: Ctx): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text) return [];
    const parts = text.split(/\r?\n/);
    const out: TextRun[] = [];
    parts.forEach((p, i) => {
      if (i > 0) out.push(makeRun("", style, true));
      if (p) out.push(makeRun(p, style));
    });
    return out;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return [makeRun("", style, true)];
  let st = { ...style };
  if (tag === "strong" || tag === "b") st.bold = true;
  if (tag === "em" || tag === "i") st.italics = true;
  if (tag === "u") st.underline = true;
  if (tag === "s" || tag === "strike" || tag === "del") st.strike = true;
  if (tag === "mark") {
    st.highlight = parseColor(el.style.backgroundColor) ?? parseColor(el.getAttribute("data-color")) ?? "FFFF00";
  }
  st = applyCss(el, st, ctx);
  if (tag === "mark" && el.style.backgroundColor) {
    // mark 的背景色已作為 highlight 處理
    st.highlight = parseColor(el.style.backgroundColor) ?? st.highlight;
  }
  const out: TextRun[] = [];
  el.childNodes.forEach((c) => out.push(...inlineRuns(c, st, ctx)));
  return out;
}

function alignmentOf(el: HTMLElement) {
  switch (el.style.textAlign) {
    case "center": return AlignmentType.CENTER;
    case "right": return AlignmentType.RIGHT;
    case "justify": return AlignmentType.JUSTIFIED;
    default: return undefined;
  }
}

function makeParagraph(
  el: HTMLElement | null,
  children: Node[],
  ctx: Ctx,
  opts: ParaOpts,
): Paragraph {
  let base: RunStyle = { ...(opts.baseStyle ?? {}) };
  if (el) base = applyCss(el, base, ctx);
  const runs: TextRun[] = [];
  children.forEach((c) => runs.push(...inlineRuns(c, base, ctx)));

  let spacingLine: number | undefined;
  const lh = el?.style.lineHeight;
  if (lh && /^[\d.]+$/.test(lh.trim())) spacingLine = Math.round(Number(lh) * 240);

  let indentLeft = opts.indentLeft;
  const ml = el?.style.marginLeft;
  if (ml && !opts.list) {
    const pt = lengthToPt(ml, ctx.defaultPt);
    if (pt && pt > 0) indentLeft = (indentLeft ?? 0) + Math.round(pt * 20);
  }

  return new Paragraph({
    children: runs,
    alignment: el ? alignmentOf(el) : undefined,
    spacing: {
      after: ctx.inTable ? 40 : 120,
      ...(spacingLine ? { line: spacingLine, lineRule: LineRuleType.AUTO } : {}),
    },
    indent: indentLeft ? { left: indentLeft } : undefined,
    numbering: opts.list ? { reference: opts.list.reference, level: opts.list.level } : undefined,
  });
}

function bulletLevels(): ILevelsOptions[] {
  const chars = ["\u2022", "\u25E6", "\u25AA"];
  return Array.from({ length: 9 }, (_, i) => ({
    level: i,
    format: LevelFormat.BULLET,
    text: chars[i % 3],
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } },
  }));
}

function orderedLevels(): ILevelsOptions[] {
  const fmts = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];
  return Array.from({ length: 9 }, (_, i) => ({
    level: i,
    format: fmts[i % 3],
    text: `%${i + 1}.`,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } },
  }));
}

function listBlocks(el: HTMLElement, ctx: Ctx, level: number, parentOpts: ParaOpts): Block[] {
  const ordered = el.tagName.toLowerCase() === "ol";
  let reference = "bullets";
  if (ordered) {
    reference = `ol-${ctx.olCount++}`;
    ctx.numbering.push({ reference, levels: orderedLevels() });
  }
  const out: Block[] = [];
  const lvl = Math.min(level, 8);
  el.childNodes.forEach((li) => {
    if (li.nodeType !== Node.ELEMENT_NODE) return;
    const liEl = li as HTMLElement;
    if (liEl.tagName.toLowerCase() !== "li") return;
    let numbered = false;
    let inlineGroup: Node[] = [];
    const flush = () => {
      if (!inlineGroup.length) return;
      out.push(
        makeParagraph(null, inlineGroup, ctx, {
          ...parentOpts,
          list: numbered ? undefined : { reference, level: lvl },
          indentLeft: numbered ? 720 * (lvl + 1) : undefined,
        }),
      );
      numbered = true;
      inlineGroup = [];
    };
    liEl.childNodes.forEach((c) => {
      if (c.nodeType === Node.ELEMENT_NODE) {
        const ce = c as HTMLElement;
        const tag = ce.tagName.toLowerCase();
        if (tag === "ul" || tag === "ol") {
          flush();
          if (!numbered) {
            out.push(makeParagraph(null, [], ctx, { ...parentOpts, list: { reference, level: lvl } }));
            numbered = true;
          }
          out.push(...listBlocks(ce, ctx, lvl + 1, parentOpts));
          return;
        }
        if (tag === "p" || /^h[1-6]$/.test(tag)) {
          flush();
          out.push(
            makeParagraph(ce, Array.from(ce.childNodes), ctx, {
              ...parentOpts,
              list: numbered ? undefined : { reference, level: lvl },
              indentLeft: numbered ? 720 * (lvl + 1) : undefined,
            }),
          );
          numbered = true;
          return;
        }
      }
      inlineGroup.push(c);
    });
    flush();
    if (!numbered) out.push(makeParagraph(null, [], ctx, { ...parentOpts, list: { reference, level: lvl } }));
  });
  return out;
}

const HEADING_PT: Record<string, number> = { h1: 20, h2: 16, h3: 14, h4: 12, h5: 11, h6: 10 };

function tableBlock(el: HTMLElement, ctx: Ctx): Table {
  const trs = Array.from(el.querySelectorAll("tr")).filter((tr) => tr.closest("table") === el);
  const first = trs[0];
  const colCount = first
    ? Array.from(first.children).reduce((n, c) => n + (Number(c.getAttribute("colspan")) || 1), 0)
    : 1;
  const cols = Math.max(1, colCount);
  const colW = Math.floor(ctx.contentWidth / cols);
  const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
  const prevIn = ctx.inTable;
  ctx.inTable = true;
  const rows = trs.map(
    (tr) =>
      new TableRow({
        children: Array.from(tr.children)
          .filter((c) => ["td", "th"].includes(c.tagName.toLowerCase()))
          .map((c) => {
            const cell = c as HTMLElement;
            const span = Number(cell.getAttribute("colspan")) || 1;
            const rowSpan = Number(cell.getAttribute("rowspan")) || 1;
            const isTh = cell.tagName.toLowerCase() === "th";
            const blocks = toBlocks(Array.from(cell.childNodes), ctx, isTh ? { baseStyle: { bold: true } } : {});
            return new TableCell({
              children: blocks.length ? blocks : [new Paragraph("")],
              columnSpan: span > 1 ? span : undefined,
              rowSpan: rowSpan > 1 ? rowSpan : undefined,
              width: { size: colW * span, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              shading: isTh ? { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" } : undefined,
            });
          }),
      }),
  );
  ctx.inTable = prevIn;
  return new Table({
    width: { size: colW * cols, type: WidthType.DXA },
    columnWidths: Array.from({ length: cols }, () => colW),
    rows,
    borders: {
      top: border, bottom: border, left: border, right: border,
      insideHorizontal: border, insideVertical: border,
    },
  });
}

function toBlocks(nodes: Node[], ctx: Ctx, opts: ParaOpts): Block[] {
  const out: Block[] = [];
  let group: Node[] = [];
  const flush = () => {
    const meaningful = group.some((n) => n.nodeType !== Node.TEXT_NODE || (n.textContent ?? "").trim() !== "");
    if (meaningful) out.push(makeParagraph(null, group, ctx, opts));
    group = [];
  };
  for (const n of nodes) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (BLOCK_TAGS.has(tag)) {
        flush();
        if (tag === "p" || /^h[1-6]$/.test(tag) || tag === "pre") {
          const headPt = HEADING_PT[tag];
          const baseStyle: RunStyle = { ...(opts.baseStyle ?? {}) };
          if (headPt) {
            baseStyle.bold = true;
            baseStyle.size = headPt * 2;
          }
          out.push(makeParagraph(el, Array.from(el.childNodes), ctx, { ...opts, baseStyle }));
        } else if (tag === "ul" || tag === "ol") {
          out.push(...listBlocks(el, ctx, 0, opts));
        } else if (tag === "table") {
          out.push(tableBlock(el, ctx));
        } else if (tag === "hr") {
          out.push(
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "808080", space: 1 } },
              spacing: { after: 120 },
            }),
          );
        } else if (tag === "blockquote") {
          out.push(...toBlocks(Array.from(el.childNodes), ctx, { ...opts, indentLeft: 720 }));
        } else {
          out.push(...toBlocks(Array.from(el.childNodes), ctx, opts));
        }
        continue;
      }
    }
    group.push(n);
  }
  flush();
  return out;
}

/** 將（已合併的）HTML 轉為 docx Document */
export function htmlToDocument(html: string, template: Template): Document {
  const dom = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const base = PAGE_MM[template.pageSize];
  const widthMm = template.orientation === "landscape" ? base.h : base.w;
  const m = template.margins;
  const contentWidth = mmToTwip(widthMm - m.left - m.right);
  const ctx: Ctx = {
    numbering: [{ reference: "bullets", levels: bulletLevels() }],
    olCount: 0,
    contentWidth: Math.max(contentWidth, 1440),
    inTable: false,
    defaultPt: template.fontSize,
  };
  let children = toBlocks(Array.from(dom.body.childNodes), ctx, {});
  if (children.length === 0) children = [new Paragraph("")];

  return new Document({
    creator: "Excel Mail Merge Studio",
    title: template.name,
    styles: {
      default: {
        document: {
          run: { font: primaryFontName(template.fontFamily), size: Math.round(template.fontSize * 2) },
        },
      },
    },
    numbering: { config: ctx.numbering },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: mmToTwip(base.w),
              height: mmToTwip(base.h),
              orientation:
                template.orientation === "landscape" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: mmToTwip(m.top),
              right: mmToTwip(m.right),
              bottom: mmToTwip(m.bottom),
              left: mmToTwip(m.left),
            },
          },
        },
        children,
      },
    ],
  });
}

export async function buildDocxBlob(html: string, template: Template): Promise<Blob> {
  try {
    return await Packer.toBlob(htmlToDocument(html, template));
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`.docx 產生失敗：${reason}。請檢查 Template 內容（例如表格或特殊字元），簡化後再試。`);
  }
}
