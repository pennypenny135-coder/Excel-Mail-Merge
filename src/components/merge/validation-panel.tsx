"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ValidationIssue } from "@/types/merge";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/components/ui/utils";

export function ValidationPanel({ issues, hasExcel }: { issues: ValidationIssue[]; hasExcel: boolean }) {
  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.filter((i) => i.level === "warning").length;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        {errors === 0 && warnings === 0 ? (
          <Badge tone="success">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {hasExcel ? "驗證通過" : "待上載 Excel"}
          </Badge>
        ) : (
          <>
            {errors > 0 && <Badge tone="danger">{errors} 個錯誤</Badge>}
            {warnings > 0 && <Badge tone="warning">{warnings} 個警告</Badge>}
          </>
        )}
      </div>
      <ul className="space-y-2">
        {issues.map((i) => (
          <li
            key={i.id}
            className={cn(
              "rounded-lg border p-2.5 text-xs",
              i.level === "error" && "border-destructive/40 bg-destructive/5",
              i.level === "warning" && "border-warning/40 bg-warning/5",
              i.level === "info" && "bg-muted/50",
            )}
          >
            <div className="flex items-start gap-2">
              {i.level === "error" ? (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              ) : i.level === "warning" ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              ) : (
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              )}
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {i.placeholder && <code className="rounded bg-muted px-1 py-0.5 font-semibold">{`{{${i.placeholder}}}`}</code>}
                  {i.columnLetter && <Badge>欄 {i.columnLetter}</Badge>}
                  {i.affectedRows > 0 && <Badge tone={i.level === "error" ? "danger" : "warning"}>影響 {i.affectedRows.toLocaleString()} 行</Badge>}
                </div>
                <p className="leading-relaxed">{i.message}</p>
                {i.hint && <p className="leading-relaxed text-muted-foreground">建議：{i.hint}</p>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
