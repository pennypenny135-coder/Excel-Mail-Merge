"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { ExcelRow, ParsedSheet } from "@/types/excel";
import type { Template } from "@/types/template";
import type { BlankDefault } from "@/lib/formatting";
import { buildHeaderMap, mergeRow } from "@/lib/merge";
import { pageDimensionsMm } from "@/lib/template";
import { Badge } from "@/components/ui/misc";

interface Props {
  template: Template;
  sheet: ParsedSheet;
  rows: ExcelRow[];
  fileNames: Map<number, string>;
  blankDefault: BlankDefault;
  zoom: number;
  plain: boolean;
}

export function MergePreview({ template, sheet, rows, fileNames, blankDefault, zoom, plain }: Props) {
  const items = useMemo(() => {
    const map = buildHeaderMap(sheet);
    return rows.map((row) => ({ row, res: mergeRow(template, sheet, row, blankDefault, true, map) }));
  }, [template, sheet, rows, blankDefault]);

  const dim = pageDimensionsMm(template.pageSize, template.orientation);
  const m = template.margins;

  return (
    <div className="space-y-8">
      {items.map(({ row, res }) => (
        <div key={row.rowNumber} style={{ zoom: zoom / 100 }}>
          <div className="mx-auto mb-2 flex flex-wrap items-center gap-2 text-xs" style={{ width: `${dim.w}mm`, maxWidth: "100%" }}>
            <Badge tone="primary">Excel 第 {row.rowNumber} 行</Badge>
            <span className="text-muted-foreground">{fileNames.get(row.rowNumber) ?? ""}</span>
            {res.skipped && <Badge tone="warning">此行將被略過：{res.skipReason}</Badge>}
            {res.missing.length > 0 && (
              <Badge tone="danger">
                <AlertTriangle className="mr-1 h-3 w-3" />
                缺少欄位：{Array.from(new Set(res.missing)).join("、")}
              </Badge>
            )}
            {res.blanks.length > 0 && <Badge tone="warning">空白：{Array.from(new Set(res.blanks)).join("、")}</Badge>}
          </div>
          <div
            className={`paper doc-content mx-auto ${plain ? "preview-plain" : ""}`}
            style={{
              width: `${dim.w}mm`,
              minHeight: `${dim.h}mm`,
              padding: `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`,
              fontFamily: `"${template.fontFamily}", "Microsoft JhengHei", sans-serif`,
              fontSize: `${template.fontSize}pt`,
            }}
            dangerouslySetInnerHTML={{ __html: res.html }}
          />
        </div>
      ))}
    </div>
  );
}
