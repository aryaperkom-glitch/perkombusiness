"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Upload,
  FileText,
  LogOut,
  ClipboardList,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_SECTIONS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Trips",
    items: [
      { name: "Employees", href: "/employees", icon: Users },
      { name: "Upload", href: "/upload", icon: Upload },
      { name: "Claims", href: "/claims", icon: FileText },
    ],
  },
  {
    label: "Manage Service",
    items: [
      { name: "Request EnvGate", href: "/services", icon: ClipboardList },
      { name: "Upload Klaim", href: "/services/upload", icon: Upload },
      { name: "Auto Dashboard", href: "/services/auto-dashboard", icon: BarChart3 },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-64 shrink-0 flex-col border-r border-base-300 bg-base-100 transition-[width] duration-200",
        collapsed && "lg:w-[72px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center border-b border-base-300 px-4">
        <Link
          href="/dashboard"
          className={cn(
            "flex w-full items-center gap-2.5 overflow-hidden",
            collapsed ? "lg:justify-center" : "justify-center"
          )}
        >
          <Image
            src="/ogoperkom.png"
            alt="Perkom"
            width={40}
            height={40}
            className="h-9 w-9 shrink-0 rounded-md object-contain"
            priority
          />
          {!collapsed && (
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-bold tracking-wide text-base-content">PERKOM</div>
              <div className="truncate text-[11px] text-base-content/50">Expense Approval</div>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label ?? "root"}>
            {section.label && (
              <div
                className={cn(
                  "px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/40",
                  collapsed && "lg:px-1 lg:pt-4 lg:text-center"
                )}
              >
                {collapsed ? <span className="lg:hidden">{section.label}</span> : section.label}
              </div>
            )}
            <ul className="w-full space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/services" && pathname.startsWith(`${item.href}/`)) ||
                  (item.href === "/services" && pathname === "/services");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-10 w-full items-center gap-3 rounded-field px-3 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-base-content/70 hover:bg-base-200 hover:text-base-content",
                        collapsed && "lg:tooltip lg:tooltip-right lg:justify-center lg:px-0"
                      )}
                      data-tip={collapsed ? item.name : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className={cn(collapsed && "lg:hidden")}>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="shrink-0 space-y-1 border-t border-base-300 p-2">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "btn btn-ghost btn-sm h-10 w-full gap-3 rounded-field px-3 text-sm font-normal text-base-content/60 hover:text-base-content",
            collapsed && "lg:tooltip lg:tooltip-right lg:justify-center lg:px-0"
          )}
          data-tip={collapsed ? "Expand menu" : undefined}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          <span className={cn(collapsed && "lg:hidden")}>
            {collapsed ? "" : "Collapse menu"}
          </span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "btn btn-ghost btn-sm h-10 w-full gap-3 rounded-field px-3 text-sm font-normal text-base-content/60 hover:text-error",
            collapsed && "lg:tooltip lg:tooltip-right lg:justify-center lg:px-0"
          )}
          data-tip={collapsed ? "Logout" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={cn(collapsed && "lg:hidden")}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
