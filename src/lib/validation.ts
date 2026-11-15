import type { ExcelRow, ParsedSheet } from "@/types/excel";
import type { ValidationIssue } from "@/types/merge";
import type { Template } from "@/types/template";
import {
  DEFAULT_PLACEHOLDER_SETTING,
  resolveBlankMode,
  toNumber,
  toSerial,
  type BlankDefault,
} from "@/lib/formatting";
import { extractPlaceholders } from "@/lib/template";

const NUMERIC_TYPES = ["number", "currency", "percentage"];

/**
 * 驗證 template 與 Excel 資料。
 * sheet 為 null 時只做不需要 Excel 的檢查。
 */
export function validateTemplate(
  template: Template,
  sheet: ParsedSheet | null,
  rows: ExcelRow[],
  blankDefault: BlankDefault,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const placeholders = extractPlaceholders(template.content);

  if (placeholders.length === 0) {
    issues.push({
      id: "no-placeholder",
      level: "error",
      message: "Template 內沒有任何 placeholder，產生的文件會完全相同。",
      hint: "請在 Template Editor 左側將 Excel 欄位拖入文件，或點擊欄位旁的「＋」插入 {{欄位名}}。",
      affectedRows: rows.length,
    });
  }

  if (!sheet) {
    if (placeholders.length > 0) {
      issues.push({
        id: "no-excel",
        level: "info",
        message: "尚未上載 Excel，無法驗證 placeholder 對應的欄位。",
        hint: "請先到「Excel 資料」上載 .xlsx。",
        affectedRows: 0,
      });
    }
    return issues;
  }

  if (rows.length === 0) {
    issues.push({
      id: "no-rows",
      level: "error",
      message: "目前沒有選擇任何資料行。",
      hint: "請在「資料範圍」選擇 All rows、自訂範圍或手動勾選至少一行。",
      affectedRows: 0,
    });
  }

  for (const { name, count } of placeholders) {
    const colIdx = sheet.columns.findIndex((c) => c.header === name);
    const binding = template.bindings[name];

    if (count > 1) {
      issues.push({
        id: `dup-${name}`,
        level: "info",
        placeholder: name,
        columnLetter: colIdx >= 0 ? sheet.columns[colIdx].letter : binding?.letter,
        message: `{{${name}}} 在 Template 中重複出現 ${count} 次（每處都會填入相同資料）。`,
        affectedRows: 0,
      });
    }

    if (colIdx < 0) {
      let hint = "請在右側 Placeholder 面板用「更換對應欄位」選擇現有的 Excel 欄位，或刪除此 placeholder。";
      let message = `Excel 中找不到欄位「${name}」。`;
      if (binding) {
        const atLetter = sheet.columns.find((c) => c.letter === binding.letter);
        if (atLetter) {
          message = `欄位「${name}」（原本在 ${binding.letter} 欄）可能已改名為「${atLetter.header}」。`;
          hint = `請將 {{${name}}} 更換為「${atLetter.header}」，或把 Excel 標題改回「${name}」。`;
        } else {
          message = `欄位「${name}」（原本在 ${binding.letter} 欄）已不存在，可能已被刪除。`;
        }
      }
      issues.push({
        id: `missing-${name}`,
        level: "error",
        placeholder: name,
        columnLetter: binding?.letter,
        message,
        hint,
        affectedRows: rows.length,
      });
      continue;
    }

    const col = sheet.columns[colIdx];
    const setting = template.placeholders[name] ?? DEFAULT_PLACEHOLDER_SETTING;
    const blankMode = resolveBlankMode(setting, blankDefault).mode;

    let blanks = 0;
    let badNum = 0;
    let badDate = 0;
    const wantsNum =
      ["number", "currency", "percentage"].includes(setting.format) ||
      (setting.format === "excel" && NUMERIC_TYPES.includes(col.type));
    const wantsDate =
      ["date", "customDate"].includes(setting.format) ||
      (setting.format === "excel" && col.type === "date");

    for (const row of rows) {
      const cell = row.cells[colIdx];
      if (!cell || cell.t === "blank") {
        blanks++;
        continue;
      }
      if (wantsNum && toNumber(cell) === null) badNum++;
      if (wantsDate && toSerial(cell) === null) badDate++;
    }

    if (blanks > 0) {
      issues.push({
        id: `blank-${name}`,
        level: "warning",
        placeholder: name,
        columnLetter: col.letter,
        message:
          blankMode === "skip"
            ? `${col.letter} 欄「${name}」有空白儲存格，這些行將被略過（Skip row）。`
            : blankMode === "custom"
              ? `${col.letter} 欄「${name}」有空白儲存格，將填入自訂文字「${setting.blank === "default" ? blankDefault.text : setting.blankText ?? ""}」。`
              : `${col.letter} 欄「${name}」有空白儲存格，對應位置會留空。`,
        hint: "可在 Placeholder 設定中改變空白處理方式。",
        affectedRows: blanks,
      });
    }
    if (badNum > 0) {
      issues.push({
        id: `nan-${name}`,
        level: "warning",
        placeholder: name,
        columnLetter: col.letter,
        message: `${col.letter} 欄「${name}」預期為數字，但有儲存格包含非數字內容。`,
        hint: "這些儲存格會直接輸出 Excel 顯示的文字。請檢查 Excel 資料或改用「跟隨 Excel 格式」。",
        affectedRows: badNum,
      });
    }
    if (badDate > 0) {
      issues.push({
        id: `date-${name}`,
        level: "warning",
        placeholder: name,
        columnLetter: col.letter,
        message: `${col.letter} 欄「${name}」預期為日期，但有儲存格無法解析為日期。`,
        hint: "這些儲存格會直接輸出 Excel 顯示的文字。支援格式：YYYY-MM-DD、DD/MM/YYYY 或 Excel 日期。",
        affectedRows: badDate,
      });
    }
  }

  const order = { error: 0, warning: 1, info: 2 } as const;
  return issues.sort((a, b) => order[a.level] - order[b.level]);
}
