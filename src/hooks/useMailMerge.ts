"use client";

import { useCallback, useMemo, useState } from "react";
import JSZip from "jszip";
import type { ParsedSheet } from "@/types/excel";
import type { GenerateProgress, GenerateResult, MergeSettings } from "@/types/merge";
import type { Template } from "@/types/template";
import type { BlankDefault } from "@/lib/formatting";
import { buildHeaderMap, makeFileNames, mergeRow, selectRows } from "@/lib/merge";
import { buildDocxBlob } from "@/lib/docx";

export const MAX_INDIVIDUAL_FILES = 20;

export const DEFAULT_MERGE_SETTINGS: MergeSettings = {
  rowMode: "all",
  rangeFrom: 2,
  rangeTo: 1001,
  manual: [],
  filterColumn: 0,
  filterOp: "equals",
  filterValue: "",
  output: "zip",
  fileNameColumn: 0,
  previewMode: "first",
  previewRow: 0,
};

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function useMailMerge(sheet: ParsedSheet | null) {
  const [settings, setSettings] = useState<MergeSettings>(DEFAULT_MERGE_SETTINGS);
  const [progress, setProgress] = useState<GenerateProgress>({
    running: false,
    phase: "done",
    current: 0,
    total: 0,
  });
  const [result, setResult] = useState<GenerateResult | null>(null);

  const update = useCallback((patch: Partial<MergeSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const reset = useCallback((s: ParsedSheet) => {
    const first = s.rows[0]?.rowNumber ?? 2;
    const last = s.rows[s.rows.length - 1]?.rowNumber ?? first;
    setSettings({ ...DEFAULT_MERGE_SETTINGS, rangeFrom: first, rangeTo: last });
    setResult(null);
  }, []);

  const selectedRows = useMemo(() => selectRows(sheet, settings), [sheet, settings]);

  const generate = useCallback(
    async (template: Template, sh: ParsedSheet, blankDefault: BlankDefault): Promise<GenerateResult> => {
      const rows = selectedRows;
      const res: GenerateResult = {
        success: 0,
        failed: [],
        skipped: [],
        fileNames: [],
        output: settings.output,
      };
      setResult(null);
      setProgress({ running: true, phase: "docx", current: 0, total: rows.length });
      const headerMap = buildHeaderMap(sh);
      const built: { rowNumber: number; blob: Blob; row: (typeof rows)[number] }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const merged = mergeRow(template, sh, row, blankDefault, false, headerMap);
          if (merged.skipped) {
            res.skipped.push({ rowNumber: row.rowNumber, message: merged.skipReason ?? "空白欄位，已略過" });
          } else {
            const blob = await buildDocxBlob(merged.html, template);
            built.push({ rowNumber: row.rowNumber, blob, row });
          }
        } catch (e) {
          res.failed.push({
            rowNumber: row.rowNumber,
            message: e instanceof Error ? e.message : String(e),
          });
        }
        setProgress({ running: true, phase: "docx", current: i + 1, total: rows.length });
        if (i % 3 === 0) await tick();
      }

      const names = makeFileNames(
        built.map((b) => b.row),
        settings.fileNameColumn,
        rows.length,
      );
      res.fileNames = names;
      res.success = built.length;

      if (built.length > 0) {
        try {
          if (settings.output === "zip") {
            setProgress({ running: true, phase: "zip", current: rows.length, total: rows.length });
            await tick();
            const zip = new JSZip();
            built.forEach((b, i) => zip.file(names[i], b.blob));
            const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
            const base = template.name.replace(/[\\/:*?"<>|]/g, "").trim() || "MailMerge";
            downloadBlob(blob, `${base}_${stamp()}.zip`);
          } else {
            for (let i = 0; i < built.length; i++) {
              downloadBlob(built[i].blob, names[i]);
              await wait(350);
            }
          }
        } catch (e) {
          res.downloadError = `${settings.output === "zip" ? "ZIP" : "檔案"}下載失敗：${
            e instanceof Error ? e.message : String(e)
          }。請確認瀏覽器允許下載、磁碟空間足夠，或減少選取行數後重試。`;
        }
      }
      setProgress({ running: false, phase: "done", current: rows.length, total: rows.length });
      setResult(res);
      return res;
    },
    [selectedRows, settings.output, settings.fileNameColumn],
  );

  return { settings, update, reset, selectedRows, progress, result, setResult, generate };
}

export type UseMailMerge = ReturnType<typeof useMailMerge>;
