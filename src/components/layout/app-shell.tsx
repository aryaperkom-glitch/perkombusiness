"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

export interface ShellUser {
  name: string;
  email: string;
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser | null;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="drawer lg:drawer-open">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex h-dvh flex-col">
        <div className="print:hidden">
          <Header user={user} />
        </div>
        <main className="flex-1 overflow-y-auto bg-base-200 p-4 lg:p-8 print:overflow-visible print:bg-base-100 print:p-0">
          {children}
        </main>
      </div>
      <div className="drawer-side z-50 print:hidden">
        <label htmlFor="app-drawer" aria-label="close sidebar" className="drawer-overlay" />
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>
      <Toaster />
    </div>
  );
}
