"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileArchive, Upload } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { Alert, Badge, Spinner } from "@/components/ui/misc";
import { ImportError, parseImportFile, type ImportItem, type ImportPlan } from "@/lib/transfer";

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { templates, toast } = useApp();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPlan(null);
    setError(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    onDrop: async (files) => {
      if (!files[0]) return;
      setBusy(true);
      setError(null);
      try {
        setPlan(await parseImportFile(files[0], templates.templates, templates.folders));
      } catch (e) {
        setPlan(null);
        setError(e instanceof ImportError ? e.message : `無法讀取匯入檔案：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
  });

  const setAction = (key: string, action: ImportItem["action"]) =>
    setPlan((p) => (p ? { ...p, items: p.items.map((i) => (i.key === key ? { ...i, action } : i)) } : p));
  const setAll = (action: "overwrite" | "rename" | "skip") =>
    setPlan((p) => (p ? { ...p, items: p.items.map((i) => (i.conflict ? { ...i, action } : i)) } : p));

  const willImport = plan?.items.filter((i) => i.action !== "skip").length ?? 0;
  const conflicts = plan?.items.filter((i) => i.conflict).length ?? 0;

  const doImport = async () => {
    if (!plan) return;
    setBusy(true);
    const n = await templates.applyImport(plan.items);
    setBusy(false);
    if (n > 0) {
      toast({ type: "success", title: "匯入完成 / Imported", description: `已匯入 ${n} 個 Template，資料夾結構已還原。` });
      close();
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="匯入 Templates / Import"
      description="選擇由本 app 匯出的 .zip。匯入前會先驗證內容，並讓你決定同名 Template 的處理方式。"
      footer={
        <>
          <Button variant="outline" onClick={close}>取消</Button>
          {plan && (
            <Button disabled={willImport === 0 || busy} onClick={() => void doImport()}>
              {busy ? <Spinner /> : <Upload className="h-4 w-4" />} 匯入 {willImport} 個 Template
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error" title="無法匯入">{error}</Alert>}
        {!plan && (
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center ${isDragActive ? "border-primary bg-accent" : "hover:bg-muted/50"}`}
          >
            <input {...getInputProps()} />
            {busy ? <Spinner className="h-6 w-6" /> : <FileArchive className="h-8 w-8 text-primary" />}
            <p className="text-sm font-medium">拖放 .zip 到此，或點擊選擇檔案</p>
          </div>
        )}
        {plan && (
          <>
            <Alert tone="info" title={`將匯入 ${willImport} / ${plan.items.length} 個 Template`}>
              {conflicts > 0 ? `其中 ${conflicts} 個與現有 Template 同名（同一資料夾），請選擇處理方式。` : "沒有同名衝突。"}
            </Alert>
            {plan.errors.length > 0 && (
              <Alert tone="warning" title={`有 ${plan.errors.length} 個項目格式不正確，已排除`}>
                <ul className="list-disc pl-4">{plan.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </Alert>
            )}
            {conflicts > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                同名全部：
                <Button size="sm" variant="outline" onClick={() => setAll("overwrite")}>覆蓋 Overwrite</Button>
                <Button size="sm" variant="outline" onClick={() => setAll("rename")}>重新命名 Rename</Button>
                <Button size="sm" variant="outline" onClick={() => setAll("skip")}>略過 Skip</Button>
              </div>
            )}
            <ul className="divide-y rounded-lg border">
              {plan.items.map((i) => (
                <li key={i.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.template.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.template.folderPath.length ? i.template.folderPath.slice(0, 3).join(" / ") : "（根目錄）"}
                    </p>
                  </div>
                  {i.conflict ? (
                    <>
                      <Badge tone="warning">同名</Badge>
                      <Select className="h-8 w-40 text-xs" value={i.action} onChange={(e) => setAction(i.key, e.target.value as ImportItem["action"])}>
                        <option value="overwrite">覆蓋 Overwrite</option>
                        <option value="rename">重新命名 Rename</option>
                        <option value="skip">略過 Skip</option>
                      </Select>
                    </>
                  ) : (
                    <Badge tone="success">新增</Badge>
                  )}
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" onClick={reset}>重新選擇檔案</Button>
          </>
        )}
      </div>
    </Modal>
  );
}
