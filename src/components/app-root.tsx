"use client";

import { AppProvider } from "@/components/app-context";
import { AppShell } from "@/components/app-shell";

export function AppRoot() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
