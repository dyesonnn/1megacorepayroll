"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import PrintButton from "./PrintButton";
import ZoomControls from "./ZoomControls";

export default function PayslipViewer({
  periodName,
  employeeName,
  children,
}: {
  periodName: string;
  employeeName: string;
  children: ReactNode;
}) {
  const [scale, setScale] = useState(100);

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      {/* Toolbar — hidden when printing */}
      <div className="no-print max-w-[1000px] mx-auto mb-4 flex items-center justify-between">
        <Link
          href="/payroll"
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          ← Back to Payroll
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {periodName} · {employeeName}
          </span>
          <ZoomControls onScaleChange={setScale} />
          <PrintButton />
        </div>
      </div>

      {/* Printable payslip sheet */}
      <div id="print-area">
        <div
          style={{
            transform: `scale(${scale / 100})`,
            transformOrigin: "top center",
            transition: "transform 0.15s ease",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
