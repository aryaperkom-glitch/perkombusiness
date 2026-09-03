"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut, User } from "lucide-react";
import type { ShellUser } from "@/components/layout/app-shell";

const pageTitles: [prefix: string, title: string][] = [
  ["/dashboard", "Dashboard"],
  ["/employees", "Employee Master"],
  ["/upload", "Upload Statement"],
  ["/claims/managed-service", "Managed Service Claims"],
  ["/claims", "Claims"],
  ["/services/auto-dashboard", "Auto Dashboard"],
  ["/services/upload", "Upload Klaim"],
  ["/services", "Request EnvGate"],
];

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/claims/")) return "Claim Detail";
  const match = pageTitles.find(([prefix]) => pathname.startsWith(prefix));
  return match?.[1] ?? "Perkom";
}

export function Header({ user }: { user: ShellUser | null }) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <header className="navbar h-16 min-h-16 gap-4 border-b border-base-300 bg-base-100 px-4 shadow-sm lg:px-6">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <label
            htmlFor="app-drawer"
            className="btn btn-ghost btn-circle btn-sm lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </label>
          <nav
            className="flex min-w-0 items-center gap-2 text-sm"
            aria-label="Breadcrumb"
          >
            <Link href="/dashboard" className="font-semibold text-base-content">
              PERKOM
            </Link>
            <span className="text-base-content/30" aria-hidden>
              /
            </span>
            <span className="truncate font-medium text-base-content">
              {title}
            </span>
          </nav>
        </div>
      </div>

      <div className="flex gap-2">
        {user && (
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost btn-circle avatar border border-base-300 bg-base-100"
              aria-label="User menu"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full">
                <User className="h-5 w-5 text-base-content/60" />
              </div>
            </div>
            <ul
              tabIndex={-1}
              className="menu menu-sm dropdown-content z-1 mt-3 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow"
            >
              <li className="menu-title">{user.email}</li>
              <li>
                <button type="button" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
