"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

interface AttendanceRecord {
  timeIn: string | null;
  timeOut: string | null;
  hoursWorked: number;
  overtimeHours: number;
  lateMinutes: number;
  status: string;
  siteName: string;
}

interface AttendanceSheetProps {
  employees: Employee[];
  attendance: Record<string, Record<string, AttendanceRecord>>;
  year: number;
  month: number; // 0-indexed
  daysInMonth: number;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  PRESENT: { bg: "bg-green-100", text: "text-green-700" },
  LATE: { bg: "bg-yellow-100", text: "text-yellow-700" },
  ABSENT: { bg: "bg-red-100", text: "text-red-700" },
  UNDERTIME: { bg: "bg-orange-100", text: "text-orange-700" },
  HALF_DAY: { bg: "bg-purple-100", text: "text-purple-700" },
  REST_DAY: { bg: "bg-slate-100", text: "text-slate-500" },
  HOLIDAY: { bg: "bg-blue-100", text: "text-blue-700" },
};

const statusShort: Record<string, string> = {
  PRESENT: "P",
  LATE: "L",
  ABSENT: "A",
  UNDERTIME: "U",
  HALF_DAY: "H",
  REST_DAY: "R",
  HOLIDAY: "HD",
};

export default function AttendanceSheet({
  employees,
  attendance,
  year,
  month,
  daysInMonth,
}: AttendanceSheetProps) {
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
    router.push(`/attendance/sheet?month=${newMonth}`);
  };

  const getDayOfWeek = (day: number) => {
    const date = new Date(year, month, day);
    return date.getDay();
  };

  const isWeekend = (day: number) => {
    const dow = getDayOfWeek(day);
    return dow === 0 || dow === 6;
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "—";
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

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
          .print-hide-cols {
            display: none;
          }
        }
      `}</style>

      {/* Print Header (hidden on screen) */}
      <div className="print-header hidden">
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>
          1MegaCore Construction Services
        </h1>
        <h2 style={{ fontSize: '14px', fontWeight: '600', margin: '5px 0' }}>
          Monthly Attendance Sheet
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Employees</p>
          <p className="text-2xl font-bold text-slate-900">{employees.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Days in Month</p>
          <p className="text-2xl font-bold text-slate-900">{daysInMonth}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Records</p>
          <p className="text-2xl font-bold text-slate-900">
            {Object.values(attendance).reduce((sum, emp) => sum + Object.keys(emp).length, 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Avg. Attendance</p>
          <p className="text-2xl font-bold text-slate-900">
            {employees.length > 0
              ? Math.round(
                  (Object.values(attendance).reduce((sum, emp) => sum + Object.keys(emp).length, 0) /
                    (employees.length * daysInMonth)) *
                    100
                )
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Attendance Grid */}
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
                      className={`px-2 py-3 text-center font-medium text-xs min-w-[50px] ${
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
                <th className="px-3 py-3 text-center font-medium text-slate-700 min-w-[60px]">
                  Total
                </th>
              </tr>
            </thead>

            {/* Body - Employees */}
            <tbody>
              {employees.map((emp, empIdx) => {
                const empAttendance = attendance[emp.id] || {};
                let presentDays = 0;

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
                      const record = empAttendance[dateKey];
                      const weekend = isWeekend(day);

                      if (record) {
                        presentDays++;
                        const colors = statusColors[record.status] || {
                          bg: "bg-slate-100",
                          text: "text-slate-600",
                        };

                        return (
                          <td
                            key={day}
                            className={`px-1 py-2 text-center cursor-pointer hover:ring-2 hover:ring-blue-400 ${
                              weekend ? "bg-slate-50" : ""
                            }`}
                            onMouseEnter={() => setHoveredCell({ empId: emp.id, day })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            <div
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                              title={`${emp.firstName} ${emp.lastName} - ${dateKey}\nStatus: ${record.status}\nTime In: ${formatTime(record.timeIn)}\nTime Out: ${formatTime(record.timeOut)}\nHours: ${record.hoursWorked}h\nSite: ${record.siteName}`}
                            >
                              {statusShort[record.status] || "?"}
                            </div>
                            {/* Tooltip on hover */}
                            {hoveredCell?.empId === emp.id && hoveredCell?.day === day && (
                              <div className="absolute z-20 mt-1 bg-slate-900 text-white text-xs rounded-lg p-2 shadow-lg whitespace-nowrap">
                                <div className="font-medium">{status}</div>
                                <div>In: {formatTime(record.timeIn)}</div>
                                <div>Out: {formatTime(record.timeOut)}</div>
                                <div>Hours: {record.hoursWorked}h</div>
                                {record.overtimeHours > 0 && (
                                  <div className="text-green-400">OT: +{record.overtimeHours}h</div>
                                )}
                                {record.lateMinutes > 0 && (
                                  <div className="text-yellow-400">Late: {record.lateMinutes}min</div>
                                )}
                                <div className="text-slate-400">{record.siteName}</div>
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
                          {weekend ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 text-xs">
                              —
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-400 text-xs">
                              A
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center">
                      <span className="font-semibold text-slate-900">{presentDays}</span>
                      <span className="text-slate-500">/{daysInMonth}</span>
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

      {/* Legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 print-area">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4">
          {Object.entries(statusShort).map(([status, short]) => {
            const colors = statusColors[status];
            return (
              <div key={status} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                >
                  {short}
                </span>
                <span className="text-sm text-slate-600">
                  {status.replace("_", " ").toLowerCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
