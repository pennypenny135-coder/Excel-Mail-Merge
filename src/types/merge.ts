export type RowMode = "all" | "range" | "manual" | "filter";
export type PreviewMode = "first" | "single" | "first10" | "all";
export type OutputMode = "zip" | "individual";

export interface MergeSettings {
  rowMode: RowMode;
  rangeFrom: number;
  rangeTo: number;
  manual: number[];
  filterColumn: number;
  filterOp: "equals" | "contains";
  filterValue: string;
  output: OutputMode;
  fileNameColumn: number;
  previewMode: PreviewMode;
  previewRow: number;
}

export type IssueLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  id: string;
  level: IssueLevel;
  placeholder?: string;
  columnLetter?: string;
  message: string;
  hint?: string;
  affectedRows: number;
}

export interface GenerateProgress {
  running: boolean;
  phase: "docx" | "zip" | "done";
  current: number;
  total: number;
}

export interface GenerateResult {
  success: number;
  failed: { rowNumber: number; message: string }[];
  skipped: { rowNumber: number; message: string }[];
  fileNames: string[];
  output: OutputMode;
  downloadError?: string;
}
