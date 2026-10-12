"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userRole: string;
  userName: string;
  /** Drawer state — ignored from `lg` up, where the sidebar is always shown. */
  open?: boolean;
  onClose?: () => void;
}

const menuItems = {
  ADMIN: [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/employees", label: "Employees", icon: "👥" },
    { href: "/sites", label: "Project Sites", icon: "🏗️" },
    { href: "/attendance", label: "Attendance", icon: "📅" },
    { href: "/payroll", label: "Payroll", icon: "💰" },
    { href: "/payroll/cash-advances", label: "Cash Advances", icon: "💵" },
    { href: "/payroll/cash-advances/settings", label: "CA Settings", icon: "⚙️" },
    { href: "/reports", label: "Reports", icon: "📈" },
    { href: "/admin/users", label: "User Accounts", icon: "🔑" },
    { href: "/change-password", label: "Change Password", icon: "🔒" },
  ],
  HR: [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/employees", label: "Employees", icon: "👥" },
    { href: "/sites", label: "Project Sites", icon: "🏗️" },
    { href: "/attendance", label: "Attendance", icon: "📅" },
    { href: "/payroll", label: "Payroll", icon: "💰" },
    { href: "/payroll/cash-advances", label: "Cash Advances", icon: "💵" },
    { href: "/reports", label: "Reports", icon: "📈" },
    { href: "/change-password", label: "Change Password", icon: "🔒" },
  ],
  EMPLOYEE: [
    { href: "/dashboard", label: "My Dashboard", icon: "📊" },
    { href: "/attendance", label: "My Attendance", icon: "📅" },
    { href: "/payroll", label: "My Payslips", icon: "💰" },
    { href: "/change-password", label: "Change Password", icon: "🔒" },
  ],
};

export default function Sidebar({ userRole, userName, open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const items = menuItems[userRole as keyof typeof menuItems] || menuItems.EMPLOYEE;

  return (
    <aside
      className={cn(
        // Below lg this is an off-canvas drawer, so the page gets the full width.
        "fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col bg-slate-900 text-white",
        "transition-transform duration-200 ease-out",
        "lg:static lg:z-auto lg:translate-x-0 lg:min-h-screen",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
            1M
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm leading-tight">1MegaCore</h1>
            <p className="text-xs text-slate-400">Construction Services</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden -mr-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                // Closing on the tap itself keeps the drawer from covering the
                // page the user just asked for.
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-sm transition-colors",
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User info & Logout */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center text-sm font-medium">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-slate-400">{userRole}</p>
          </div>
        </div>
        <a
          href="/api/auth/logout"
          className="btn-glow flex items-center justify-center gap-2 w-full px-3 py-3 lg:py-2.5 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white text-sm rounded-lg transition-colors"
        >
          <span>🚪</span>
          <span>Logout</span>
        </a>
      </div>
    </aside>
  );
}
