# Excel Mail Merge Studio

在瀏覽器內，以 Excel (.xlsx) 資料批次產生格式化 Word (.docx) 文件的純前端 web app。
用戶 **不需要** 上傳 Word template：可直接由 Word 複製貼上，或在 app 內的 rich text editor 撰寫 template，再把 Excel 欄位拖入文件即可。

> **所有 Excel 資料、Template 及產生的文件都只在你的瀏覽器處理，不會上傳到任何伺服器。**

## 功能列表

- **Excel 讀取**：`.xlsx`；選擇 sheet、自動偵測／手動設定 header row、自動忽略空白行、最多處理 1,000 行（超過會顯示警告：「Excel 資料超過 1,000 行，只會處理首 1,000 行。」）
- **欄位分析**：Excel 欄位字母、標題、類型推斷（Text／Number／Currency／Percentage／Date／Empty）、前 5 筆範例、是否被 template 使用；重複標題自動顯示為「欄位名 (B)」
- **保留 Excel 顯示格式**：優先使用 cell 的 formatted value（`HK$12,345.60`、`12.5%`、`1,234`、日期不會變成 serial number）
- **Placeholder 輸出格式**：跟隨 Excel（預設）／純文字／數字／貨幣／百分比／日期／自訂日期格式（如 `DD/MM/YYYY`、`YYYY-MM-DD`）
- **空白儲存格處理**：留空（預設）／以自訂文字取代／略過該行並警告
- **Template**：多個 template、最多三層資料夾（可摺疊、搜尋、建立／重新命名／移動／刪除）、複製、頁面設定（A4／A5／Letter、直向／橫向、頁邊距）、預設字體及字級、版本號
- **Rich text editor（Tiptap）**：粗體、斜體、底線、刪除線、字體、字級、文字顏色、醒目提示、對齊、行距、項目符號／編號清單、縮排、表格、分隔線、清除格式、復原／重做、Word 貼上自動清理
- **Excel 欄位拖放**：拖入 editor 變成 `{{欄位名}}`；可多選一次插入；點擊 placeholder 查看／更換對應欄位或刪除；亦可直接輸入 `{{欄位名}}`
- **驗證**：沒有 placeholder、欄位不存在／改名、重複 placeholder、空白 cell、數字欄含非數字、日期無法解析；顯示 placeholder 名稱、欄位字母、說明及受影響行數
- **預覽**：第一筆／任一筆／前 10 筆／所有已選資料，所見即所得（字體、字級、顏色、表格、Excel 格式值、缺漏警告）
- **資料範圍**：全部／自訂行範圍／手動勾選／條件篩選
- **批次產生 .docx**：逐行產生，顯示進度（`Generating 35 / 1,000 documents...`），完成後顯示成功／失敗／略過數量；打包 ZIP 下載或下載個別檔案（最多 20 份）
- **檔名規則**：預設使用第一個 Excel 欄位；空白使用 `Document_001.docx`；移除 `\ / : * ? " < > |`；重複自動加 `-2`、`-3`
- **本地儲存（IndexedDB）**：Templates、資料夾、欄位 mapping、偏好設定、最近使用 Excel 的 metadata（不含完整資料）
- **匯出／匯入**：選擇單一／多個 template／整個資料夾匯出 `.zip`；匯入時驗證結構、處理同名（覆蓋／重新命名／略過）並還原資料夾結構
- **UI**：繁體中文為主、重要操作附英文；Light／Dark mode；Tooltip、空狀態、載入狀態、錯誤狀態；所有錯誤訊息都附具體原因及建議行動

## 技術棧

| 用途 | 套件 |
| --- | --- |
| Framework | Next.js (App Router) + React + TypeScript |
| 樣式 | Tailwind CSS v4、自建 shadcn/ui 風格元件（`src/components/ui`）、lucide-react |
| Excel | SheetJS (`xlsx`) |
| Rich text | Tiptap（StarterKit、text-style、highlight、text-align、table + 自訂 Placeholder 節點） |
| .docx 產生 | `docx` |
| ZIP | `jszip` |
| 本地儲存 | `idb-keyval`（IndexedDB） |
| 檔案上傳 | `react-dropzone` |

## 專案結構

```text
src/
  app/                 page.tsx, layout.tsx, globals.css, api/health（僅供部署平台健康檢查）
  components/
    ui/                Button、Input、Modal、Alert 等基礎元件
    excel/             上載、Excel Data 頁面、欄位面板
    templates/         資料夾樹、Template 列表、匯出／匯入
    editor/            Tiptap 擴充、工具列、右側面板
    merge/             預覽、驗證面板、Mail Merge 頁面
    dashboard/ settings/
  hooks/               useExcel、useTemplates、useMailMerge
  lib/                 excel、formatting、template、merge、validation、docx、storage、transfer
  types/               excel、template、merge
```

## 本機安裝步驟

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 產生 production build
npm run start
```

需要 Node.js 18.18 以上（建議 20+）。

## Vercel deployment 步驟

1. 將專案推送到 GitHub／GitLab／Bitbucket。
2. 到 [vercel.com/new](https://vercel.com/new) 匯入該 repository。
3. Framework Preset 會自動偵測為 **Next.js**；Build Command 使用預設的 `next build`，**不需要設定任何環境變數**。
4. 按 Deploy 即可。

本 app 沒有資料庫、後端 API 或 authentication。`/api/health` 只是回傳 `{ ok: true }` 的靜態健康檢查端點，不處理任何用戶資料，可安全保留或刪除。`src/db`、`drizzle`、`pg` 為專案樣板遺留，app 不使用。

## 使用流程

1. **上載 Excel**：到「Excel 資料」上載 `.xlsx`，確認 sheet、標題行及欄位類型。
2. **建立 Template**：到「Templates」→「建立 Template」。在編輯器撰寫內容，或由 Word 複製貼上（會自動清理格式）。
3. **拖入欄位**：由左側欄位清單把欄位拖進文件（或點「＋」／勾選多個後批量插入），變成 `{{客戶名稱}}`。點擊 placeholder 可在右側設定輸出格式及空白處理。
4. **儲存**：按頂部「儲存 Save」。
5. **預覽及驗證**：到「郵件合併」選擇資料範圍，預覽結果並查看驗證訊息。
6. **產生文件**：按「產生文件 Generate Documents」，確認數量後自動下載 ZIP。

## Template export / import 說明

- 匯出：Templates 頁面或設定頁 →「匯出 Export」→ 選擇 template／整個資料夾。
- ZIP 內容：

  ```text
  manifest.json       匯出資訊（版本、日期、template 清單）
  templates.json      所有 template + 資料夾路徑（匯入時使用）
  templates/*.json    每個 template 的獨立 JSON
  README.txt          說明
  ```
- 匯入：「匯入 Import」→ 選擇 ZIP → 系統驗證 JSON 結構並顯示將匯入的數量 → 如有同名（同一資料夾）可選擇 **覆蓋 / 重新命名 / 略過** → 自動還原資料夾結構（最多三層）。
- ZIP 內 **不含 Excel 資料**。

## Assumptions（未明確細節採用的預設）

- 技術上以 Next.js 16 / Tiptap 3 / Tailwind 4 實作；UI 元件為自行撰寫的 shadcn/ui 風格元件，而非透過 CLI 安裝。
- 重複欄位標題時，**每一個**重複的欄位都會加上欄位字母（例如 `姓名 (B)`、`姓名 (C)`），以確保每個 placeholder 名稱唯一；無標題欄位命名為「欄位 X」。
- Header row 自動偵測：若第 1 行大部分是文字則使用第 1 行；否則在首 15 行內尋找第一個「欄位數量足夠、以文字為主」的行。用戶可隨時手動更改。
- Excel 內建短日期格式（number format ID 14，會隨系統地區而異）在香港地區顯示為 `DD/MM/YYYY`，因此 app 以 `DD/MM/YYYY` 輸出。其他明確的日期格式（如 `yyyy-mm-dd`）使用 Excel 自身的 formatted value。
- 「Plain text」輸出：原始值（日期為 `YYYY-MM-DD`，數字不含千分位）。「Number」預設含千分位；「Currency」預設符號 `HK$`、2 位小數；「Percentage」把原始值乘 100。
- 檔名含非法字元時，會先 **移除** 非法字元；只有結果為空白（或為 Windows 保留名稱如 `CON`）時才使用 `Document_001.docx`。
- 產生文件時，被「略過」的行不會佔用 `Document_NNN` 編號。
- 有「錯誤級別」驗證問題（例如欄位不存在、未選擇任何行）時，會禁止產生文件；警告（如空白 cell）不會阻止。
- 預覽及產生使用目前編輯中的 template（包括未儲存修改）。
- 「條件篩選」支援單一欄位「等於／包含」（不分大小寫）。
- 縮排以每級 36pt 計算；行距選項為 1、1.15、1.5、2、2.5、3 倍。

## 已知限制

- 只支援 `.xlsx`；不支援 `.xls`、`.xlsm`、`.csv`；只處理首 1,000 行資料。
- 合併儲存格（merged cells）只會讀取左上角儲存格的值；公式使用 Excel 最後儲存的計算結果。
- Excel 若沒有儲存 formatted text（例如由程式產生的檔案），會由 SheetJS 依 number format 計算顯示值，個別地區專屬格式可能與 Excel 顯示略有差異。
- Word 貼上只保留粗體／斜體／底線／字級／顏色／對齊／清單／表格／段落；不保留 theme、頁首頁尾、浮動圖片、複雜版面。圖片目前不支援。
- 表格不支援拖曳調整欄寬（欄寬平均分配）；.docx 內的清單使用標準 Word 編號格式。
- .docx 輸出由 HTML 轉換而成，與 editor 的排版非常接近，但不保證與 Word 的分頁位置完全一致。
- 一次下載多個個別檔案時，部分瀏覽器可能提示「是否允許下載多個檔案」，需用戶允許。
- 資料只存在於目前瀏覽器；清除瀏覽器資料或換瀏覽器後 template 會消失，請定期匯出備份。

## 資料私隱說明

- 沒有資料庫、沒有後端 API、沒有 authentication、沒有第三方分析。
- Excel 檔案只在瀏覽器記憶體中讀取，重新整理頁面後即清除；IndexedDB **只儲存** template、資料夾、設定及最近使用 Excel 的 metadata（檔名、sheet、行數、欄位名稱）。
- .docx 及 ZIP 都在瀏覽器內產生並直接下載。
- 可在「設定」→「清除本機資料」永久刪除所有本機資料。

## 常見問題

**上載後顯示「不支援的格式」？** 請用 Excel 另存為 `.xlsx`。

**重新整理後 Excel 不見了？** 這是刻意設計（為保障私隱）。Template、資料夾及欄位設定會保留，只需重新上載 Excel。

**Excel 欄位改名後 template 出現錯誤？** 在「郵件合併」驗證面板會提示「欄位可能已改名」。選取文件內的 placeholder，用右側「更換對應欄位」改為新欄位即可。

**日期變成數字（如 45976）？** 請確認 Excel 儲存格已設為日期格式，或在 placeholder 設定選擇「日期」／「自訂日期格式」。

**最多可產生多少份？** ZIP 模式最多處理 1,000 行；個別下載模式最多 20 份。

**為什麼 Word 貼上後格式有少許不同？** 為避免壞掉的 HTML，app 會清理 Word 專用樣式，只保留支援的格式。
