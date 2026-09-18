"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTable, { type Column } from "@/components/DataTable";
import { formatDate, formatTime } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
  employeeNumber: string;
  employeeName: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  hoursWorked: number;
  overtimeHours: number;
  lateMinutes: number;
  undertimeMinutes: number;
  status: string;
  holidayType?: string | null;
  siteName: string;
}

interface AttendanceTableProps {
  records: AttendanceRecord[];
  showEmployeeName: boolean;
  userRole: string;
}

const statusStyles: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700",
  ABSENT: "bg-red-100 text-red-700",
  LATE: "bg-yellow-100 text-yellow-700",
  UNDERTIME: "bg-orange-100 text-orange-700",
  HALF_DAY: "bg-purple-100 text-purple-700",
  REST_DAY: "bg-slate-100 text-slate-600",
  HOLIDAY: "bg-blue-100 text-blue-700",
};

export default function AttendanceTable({ records, showEmployeeName, userRole }: AttendanceTableProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: newStatus,
          type: "update",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Failed to update status");
        setIsError(true);
        return;
      }

      setMessage("Status updated!");
      setIsError(false);
      router.refresh();
    } catch {
      setMessage("Connection error");
      setIsError(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attendance record?")) return;

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "delete" }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Failed to delete record");
        setIsError(true);
        return;
      }

      setMessage("Record deleted");
      setIsError(false);
      router.refresh();
    } catch {
      setMessage("Connection error");
      setIsError(true);
    }
  };

  const ActionColumn = {
    key: "actions",
    label: "Actions",
    render: (item: AttendanceRecord) => {
      if (userRole === "EMPLOYEE") return null;

      return (        <div className="flex gap-2">
          {/* Quick status change — holidays are set via Day Type in the form or the Holidays page */}
          <select
            value={item.status}
            onChange={(e) => handleStatusUpdate(item.id, e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
          >
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="ABSENT">Absent</option>
            <option value="UNDERTIME">Undertime</option>
          </select>

          {/* Delete button */}
          <button
            onClick={() => handleDelete(item.id)}
            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200"
            title="Delete record"
          >
            🗑️
          </button>
        </div>
      );
    },
  };

  const columns: Column[] = [
    ...(showEmployeeName
      ? [
          {
            key: "employeeName",
            label: "Employee",
            sortable: true,
            render: (item: AttendanceRecord) => (
              <div>
                <p className="font-medium text-slate-900">{item.employeeName}</p>
                <p className="text-xs text-slate-500">{item.employeeNumber}</p>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (item: AttendanceRecord) => formatDate(item.date),
    },
    { key: "siteName", label: "Site", sortable: true },
    {
      key: "timeIn",
      label: "Time In",
      render: (item: AttendanceRecord) => (item.timeIn ? formatTime(item.timeIn) : "—"),
    },
    {
      key: "timeOut",
      label: "Time Out",
      render: (item: AttendanceRecord) => (item.timeOut ? formatTime(item.timeOut) : "—"),
    },
    {
      key: "hoursWorked",
      label: "Hours",
      sortable: true,
      render: (item: AttendanceRecord) => (
        <span className="font-medium">{item.hoursWorked.toFixed(1)}h</span>
      ),
    },
    {
      key: "overtimeHours",
      label: "OT",
      sortable: true,
      render: (item: AttendanceRecord) =>
        item.overtimeHours > 0 ? (
          <span className="text-green-600 font-medium">+{item.overtimeHours.toFixed(1)}h</span>
        ) : (
          "—"
        ),
    },
    {
      key: "lateMinutes",
      label: "Late",
      sortable: true,
      render: (item: AttendanceRecord) =>
        item.lateMinutes > 0 ? (
          <span className="text-red-600">{item.lateMinutes}min</span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (item: AttendanceRecord) => (
        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[item.status] || "bg-slate-100 text-slate-600"}`}>
          {item.status === "HOLIDAY" ? (item.holidayType === "SPECIAL" ? "HOLIDAY (SPECIAL)" : "HOLIDAY (REGULAR)") : item.status}
        </span>
      ),
    },
    ActionColumn,
  ];

  return (
    <div>
      {message && (
        <div className={`text-sm rounded-lg px-4 py-3 mb-4 ${
          isError ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"
        }`}>
          {message}
        </div>
      )}
      <DataTable
        columns={columns}
        data={records}
        pageSize={15}
      />
    </div>
  );
}
