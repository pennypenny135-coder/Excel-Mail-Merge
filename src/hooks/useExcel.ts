"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LoadedWorkbook, ParsedSheet } from "@/types/excel";
import { detectHeaderRow, ExcelError, loadWorkbook, parseSheet } from "@/lib/excel";

export interface ExcelState {
  workbook: LoadedWorkbook | null;
  sheetName: string;
  headerRow: number;
  sheet: ParsedSheet | null;
  loading: boolean;
  error: string | null;
  autoDetected: boolean;
}

const INITIAL: ExcelState = {
  workbook: null,
  sheetName: "",
  headerRow: 1,
  sheet: null,
  loading: false,
  error: null,
  autoDetected: false,
};

function message(e: unknown): string {
  if (e instanceof ExcelError) return e.message;
  return `讀取 Excel 時發生未預期的錯誤：${e instanceof Error ? e.message : String(e)}。請重新上載檔案；如問題持續，請嘗試另存為新的 .xlsx。`;
}

export function useExcel(onLoaded: (sheet: ParsedSheet, wb: LoadedWorkbook) => void) {
  const [state, setState] = useState<ExcelState>(INITIAL);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  const loadFile = useCallback(async (file: File) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const wb = await loadWorkbook(file);
      let lastError = "";
      for (const name of wb.sheetNames) {
        try {
          const header = await detectHeaderRow(wb, name);
          const sheet = await parseSheet(wb, name, header);
          setState({
            workbook: wb,
            sheetName: name,
            headerRow: header,
            sheet,
            loading: false,
            error: null,
            autoDetected: true,
          });
          onLoadedRef.current(sheet, wb);
          return;
        } catch (e) {
          lastError = message(e);
        }
      }
      setState({
        workbook: wb,
        sheetName: wb.sheetNames[0] ?? "",
        headerRow: 1,
        sheet: null,
        loading: false,
        error: `所有工作表都無法使用。${lastError}`,
        autoDetected: false,
      });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: message(e) }));
    }
  }, []);

  const selectSheet = useCallback(
    async (name: string) => {
      const wb = state.workbook;
      if (!wb) return;
      setState((s) => ({ ...s, loading: true, error: null, sheetName: name }));
      try {
        const header = await detectHeaderRow(wb, name);
        const sheet = await parseSheet(wb, name, header);
        setState((s) => ({ ...s, headerRow: header, sheet, loading: false, autoDetected: true }));
        onLoadedRef.current(sheet, wb);
      } catch (e) {
        setState((s) => ({ ...s, sheet: null, loading: false, error: message(e) }));
      }
    },
    [state.workbook],
  );

  const changeHeaderRow = useCallback(
    async (row: number) => {
      const wb = state.workbook;
      if (!wb) return;
      setState((s) => ({ ...s, loading: true, error: null, headerRow: row }));
      try {
        const sheet = await parseSheet(wb, state.sheetName, row);
        setState((s) => ({ ...s, sheet, loading: false, autoDetected: false }));
        onLoadedRef.current(sheet, wb);
      } catch (e) {
        setState((s) => ({ ...s, sheet: null, loading: false, error: message(e) }));
      }
    },
    [state.workbook, state.sheetName],
  );

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, loadFile, selectSheet, changeHeaderRow, reset };
}

export type UseExcel = ReturnType<typeof useExcel>;
