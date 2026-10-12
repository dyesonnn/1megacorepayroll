"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole: string;
  userName: string;
}

export default function DashboardLayout({ children, userRole, userName }: DashboardLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Escape is the one dismissal a tap can't cover.
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar — the sidebar is a drawer below lg */}
      <header className="lg:hidden fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 bg-slate-900 px-2 text-white">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          ☰
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">
            1M
          </div>
          <span className="truncate text-sm font-semibold">1MegaCore</span>
        </div>
      </header>

      {/* Backdrop: tap anywhere to dismiss the drawer */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/60"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        userRole={userRole}
        userName={userName}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="flex-1 min-w-0 bg-slate-50 overflow-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
