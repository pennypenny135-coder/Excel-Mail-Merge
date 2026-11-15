"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

const PALETTE = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#d92d20", "#f79009", "#fedf89", "#12b76a", "#2e90fa", "#7a5af8",
  "#7a271a", "#93370d", "#b54708", "#05603a", "#1849a9", "#4a1fb8",
  "#fda29b", "#fec84b", "#ffff00", "#6ce9a6", "#84caff", "#b692f6",
];

interface Props {
  icon: ReactNode;
  title: string;
  value?: string;
  onPick: (color: string) => void;
  onClear: () => void;
  clearLabel?: string;
}

export function ColorPicker({ icon, title, value, onPick, onClear, clearLabel = "清除 / None" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" title={title} aria-label={title} onClick={() => setOpen((o) => !o)} active={open}>
        <span className="flex flex-col items-center leading-none">
          {icon}
          <span className="mt-0.5 h-[3px] w-4 rounded-sm border" style={{ background: value || "transparent" }} />
        </span>
      </Button>
      {open && (
        <div className="absolute top-9 left-0 z-30 w-48 rounded-lg border bg-card p-2 shadow-xl">
          <div className="grid grid-cols-6 gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                className="h-6 w-6 rounded border"
                style={{ background: c }}
                title={c}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              自訂
              <input
                type="color"
                className="h-6 w-8 cursor-pointer rounded border bg-transparent"
                value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
                onChange={(e) => onPick(e.target.value)}
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              {clearLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
