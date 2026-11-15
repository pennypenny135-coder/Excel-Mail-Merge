"use client";

import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Spinner } from "@/components/ui/misc";
import { cn } from "@/components/ui/utils";

export function ExcelDropzone({ compact, goToExcel }: { compact?: boolean; goToExcel?: boolean }) {
  const { excel, setView, toast } = useApp();
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    noClick: false,
    onDrop: (files) => {
      if (files.length === 0) return;
      if (files.length > 1) toast({ type: "info", title: "一次只能上載一個 Excel", description: "已使用第一個檔案。" });
      void excel.loadFile(files[0]);
      if (goToExcel) setView("excel");
    },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors",
        compact ? "px-4 py-5" : "px-6 py-14",
        isDragActive ? "border-primary bg-accent" : "bg-card hover:border-primary/60 hover:bg-muted/50",
      )}
    >
      <input {...getInputProps()} />
      {excel.loading ? (
        <>
          <Spinner className="h-6 w-6 text-primary" />
          <p className="text-sm font-medium">正在讀取 Excel… / Reading file…</p>
        </>
      ) : (
        <>
          <UploadCloud className={cn("text-primary", compact ? "h-6 w-6" : "h-10 w-10")} />
          <p className="text-sm font-medium">
            {isDragActive ? "放開以上載 / Drop to upload" : "上載 Excel / Upload Excel"}
          </p>
          <p className="text-xs text-muted-foreground">
            拖放 .xlsx 檔案到此，或點擊選擇檔案（最多處理 1,000 行；檔案只在本機讀取）
          </p>
        </>
      )}
    </div>
  );
}
