export type PageSize = "A4" | "A5" | "Letter";
export type Orientation = "portrait" | "landscape";
export type OutputFormat =
  | "excel"
  | "text"
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "customDate";
export type BlankMode = "blank" | "custom" | "skip";

export interface PlaceholderSetting {
  format: OutputFormat;
  decimals?: number;
  currencySymbol?: string;
  dateFormat?: string;
  /** default = 使用「設定」內的預設空白處理 */
  blank: BlankMode | "default";
  blankText?: string;
}

export interface ColumnBinding {
  header: string;
  letter: string;
}

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Template {
  id: string;
  name: string;
  folderId: string | null;
  description: string;
  createdAt: string;
  updatedAt: string;
  pageSize: PageSize;
  orientation: Orientation;
  /** 單位：mm */
  margins: Margins;
  fontFamily: string;
  /** 單位：pt */
  fontSize: number;
  /** Tiptap HTML */
  content: string;
  bindings: Record<string, ColumnBinding>;
  placeholders: Record<string, PlaceholderSetting>;
  version: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface Preferences {
  defaultPageSize: PageSize;
  defaultOrientation: Orientation;
  defaultFontFamily: string;
  defaultFontSize: number;
  defaultBlankMode: BlankMode;
  defaultBlankText: string;
  theme: "light" | "dark" | "system";
}

export interface RecentExcel {
  fileName: string;
  fileSize: number;
  sheetName: string;
  headerRow: number;
  rowCount: number;
  columns: string[];
  lastUsedAt: string;
}

/** 匯出／匯入用：以資料夾路徑取代 folderId */
export interface ExportedTemplate extends Omit<Template, "folderId"> {
  folderPath: string[];
}
