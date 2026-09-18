"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatPeso } from "@/lib/utils";

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

interface CashAdvanceSheetProps {
  employees: Employee[];
  advances: Record<string, Record<string, number>>;
  totalPerEmployee: Record<string, number>;
  year: number;
  month: number; // 0-indexed
  daysInMonth: number;
}

export default function CashAdvanceSheet({
  employees,
  advances,
  totalPerEmployee,
  year,
  month,
  daysInMonth,
}: CashAdvanceSheetProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hoveredCell, setHoveredCell] = useState<{
    empId: string;
    day: number;
  } | null>(null);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayAbbrevs = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const navigateMonth = (delta: number) => {
    const newDate = new Date(year, month + delta, 1);
    const newMonth = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}`;
    router.push(`/payroll/cash-advances/sheet?month=${newMonth}`);
  };

  const getDayOfWeek = (day: number) => {
    return new Date(year, month, day).getDay();
  };

  const isWeekend = (day: number) => {
    const dow = getDayOfWeek(day);
    return dow === 0 || dow === 6;
  };

  // Grand total for the month
  const grandTotal = Object.values(totalPerEmployee).reduce((s, v) => s + v, 0);

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            display: block !important;
            text-align: center;
            margin-bottom: 20px;
          }
          table {
            font-size: 10px;
          }
          th, td {
            padding: 4px 2px !important;
          }
        }
      `}</style>

      {/* Print Header (hidden on screen) */}
      <div className="print-header hidden">
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>
          1MegaCore Construction Services
        </h1>
        <h2 style={{ fontSize: '14px', fontWeight: '600', margin: '5px 0' }}>
          Monthly Cash Advance Sheet
        </h2>
        <p style={{ fontSize: '12px', margin: '5px 0' }}>
          {monthNames[month]} {year}
        </p>
      </div>

      {/* Month Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 no-print">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateMonth(-1)}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            ← Previous
          </button>
          <h2 className="text-lg font-semibold text-slate-900">
            {monthNames[month]} {year}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-600 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              🖨️ Print
            </button>
            <button
              onClick={() => navigateMonth(1)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 no-print">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Employees</p>
          <p className="text-2xl font-bold text-slate-900">{employees.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Cash Advances</p>
          <p className="text-2xl font-bold text-amber-600">{formatPeso(grandTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Employees with CA</p>
          <p className="text-2xl font-bold text-slate-900">
            {Object.keys(totalPerEmployee).length}
          </p>
        </div>
      </div>

      {/* Cash Advance Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print-area" ref={printRef}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Header - Days */}
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-medium text-slate-700 min-w-[200px]">
                  Employee
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const dow = getDayOfWeek(day);
                  return (
                    <th
                      key={day}
                      className={`px-1 py-3 text-center font-medium text-xs min-w-[65px] ${
                        isWeekend(day)
                          ? "bg-slate-100 text-slate-500"
                          : "text-slate-700"
                      }`}
                    >
                      <div>{day}</div>
                      <div className="text-[10px] font-normal">{dayAbbrevs[dow]}</div>
                    </th>
                  );
                })}
                <th className="px-3 py-3 text-center font-medium text-slate-700 min-w-[80px]">
                  Total
                </th>
              </tr>
            </thead>

            {/* Body - Employees */}
            <tbody>
              {employees.map((emp, empIdx) => {
                const empAdvances = advances[emp.id] || {};
                const empTotal = totalPerEmployee[emp.id] || 0;
                const hasAny = empTotal > 0;

                return (
                  <tr
                    key={emp.id}
                    className={`border-b border-slate-100 ${
                      empIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-xs text-slate-500">{emp.employeeNumber}</div>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const amount = empAdvances[dateKey];
                      const weekend = isWeekend(day);

                      if (amount && amount > 0) {
                        return (
                          <td
                            key={day}
                            className={`px-1 py-2 text-center cursor-pointer hover:ring-2 hover:ring-amber-400 ${
                              weekend ? "bg-slate-50" : ""
                            }`}
                            onMouseEnter={() => setHoveredCell({ empId: emp.id, day })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            <div
                              className="inline-flex items-center justify-center h-8 rounded bg-amber-100 text-amber-700 text-[11px] font-semibold px-1"
                              title={`${emp.firstName} ${emp.lastName} - ${dateKey}\nCash Advance: ${formatPeso(amount)}`}
                            >
                              {formatPeso(amount)}
                            </div>
                            {hoveredCell?.empId === emp.id && hoveredCell?.day === day && (
                              <div className="absolute z-20 mt-1 bg-slate-900 text-white text-xs rounded-lg p-2 shadow-lg whitespace-nowrap">
                                <div className="font-medium text-amber-400">Cash Advance</div>
                                <div>{formatPeso(amount)}</div>
                                <div className="text-slate-400">{dateKey}</div>
                              </div>
                            )}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={day}
                          className={`px-1 py-2 text-center ${
                            weekend ? "bg-slate-50" : ""
                          }`}
                        >
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded text-slate-300 text-xs">
                            —
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center">
                      {hasAny ? (
                        <span className="font-semibold text-amber-600">{formatPeso(empTotal)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td
                    colSpan={daysInMonth + 2}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No active employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
