"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PayslipSlip, { type SlipData } from "./PayslipSlip";

export interface PeriodOption {
  id: string;
  name: string;
}

export interface PeriodData {
  id: string;
  name: string;
  periodCovered: string;
  includeOvertimePay: boolean;
  slips: SlipData[];
}

const SLIPS_PER_PAGE = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export default function PayslipPrinter({
  periods,
  period,
  canSelect,
  preselectedEmployeeId,
}: {
  periods: PeriodOption[];
  period: PeriodData;
  canSelect: boolean;
  preselectedEmployeeId?: string;
}) {
  const router = useRouter();

  // Default selection: the clicked employee (if any), otherwise everyone.
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (canSelect && preselectedEmployeeId) {
      const match = period.slips.filter(
        (s) => s.employeeId === preselectedEmployeeId
      );
      if (match.length > 0) return new Set(match.map((s) => s.recordId));
    }
    return new Set(period.slips.map((s) => s.recordId));
  });
  const [search, setSearch] = useState("");

  const selectedSlips = useMemo(
    () => period.slips.filter((s) => selected.has(s.recordId)),
    [period.slips, selected]
  );
  const pages = useMemo(
    () => chunk(selectedSlips, SLIPS_PER_PAGE),
    [selectedSlips]
  );

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return period.slips;
    return period.slips.filter((s) => s.employeeName.toLowerCase().includes(q));
  }, [period.slips, search]);

  const toggle = (recordId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  };

  const otExcluded = period.includeOvertimePay === false;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Print/layout styles — global so they apply to the rendered pages */}
      <style jsx global>{`
        .payslip-slip {
          height: 3.2in;
        }
        .payslip-page {
          width: 8.5in;
          min-height: 11in;
          padding: 0.4in;
          background: #fff;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          gap: 0.1in;
          margin: 0 auto 1rem;
          box-sizing: border-box;
        }
        @media print {
          @page {
            size: letter portrait;
            margin: 0.4in;
          }
          .no-print {
            display: none !important;
          }
          body {
            background: #fff !important;
          }
          .payslips-preview {
            padding: 0 !important;
          }
          .payslip-page {
            width: auto !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
          }
          .payslip-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .payslip-slip {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3">
          <Link
            href="/payroll"
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ← Back to Payroll
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">
            Print Payslips
          </h1>

          <select
            value={period.id}
            onChange={(e) =>
              router.push(`/payroll/payslips?periodId=${e.target.value}`)
            }
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            title="Payroll period"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {canSelect && (
            <span className="text-sm text-slate-500">
              {selectedSlips.length} of {period.slips.length} selected ·{" "}
              {pages.length} page{pages.length !== 1 ? "s" : ""}
            </span>
          )}

          <button
            onClick={() => window.print()}
            disabled={selectedSlips.length === 0}
            className="ml-auto px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Employee picker */}
      {canSelect && (
        <div className="no-print mx-auto max-w-[1100px] px-4 mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee…"
                className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button
                onClick={() =>
                  setSelected(new Set(period.slips.map((s) => s.recordId)))
                }
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Select all
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1 max-h-64 overflow-y-auto">
              {filteredEmployees.map((s) => (
                <label
                  key={s.recordId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.recordId)}
                    onChange={() => toggle(s.recordId)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="truncate">{s.employeeName}</span>
                </label>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="text-sm text-slate-500 px-2 py-1.5">
                  No employees match.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="payslips-preview py-6">
        {selectedSlips.length === 0 ? (
          <p className="text-center text-slate-500 py-16">
            Select at least one employee to preview payslips.
          </p>
        ) : (
          <div className="overflow-x-auto">
            {pages.map((group, i) => (
              <div key={i} className="payslip-page">
                {group.map((slip) => (
                  <PayslipSlip
                    key={slip.recordId}
                    slip={slip}
                    periodCovered={period.periodCovered}
                    periodName={period.name}
                    otExcluded={otExcluded}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
