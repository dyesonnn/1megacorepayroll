"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AttendanceFormProps {
  employees: { id: string; employeeNumber: string; firstName: string; lastName: string }[];
  sites: { id: string; name: string }[];
}

export default function AttendanceForm({ employees, sites }: AttendanceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (type: string, data: Record<string, string | null>) => {
    setLoading(data.employeeId || loading);
    setMessage("");

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          date: data.date || new Date().toISOString().split("T")[0],
          type,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setMessage(result.error || "Failed to update attendance");
        setIsError(true);
        return false;
      }

      setMessage(type === "status"
        ? (data.holidayType === "SPECIAL" ? "Marked as Special Holiday (130% pay when worked)!"
          : data.holidayType === "REGULAR" ? "Marked as Regular Holiday (double pay when worked)!"
          : data.status === "PRESENT" ? "Marked as Present!"
          : data.status === "HALF_DAY" ? "Marked as Half Day!"
          : "Marked as Absent!")
        : type === "timein"
          ? "Time-in logged successfully!"
          : "Time-out logged successfully!");
      setIsError(false);
      router.refresh();
      return true;
    } catch {
      setMessage("Connection error");
      setIsError(true);
      return false;
    } finally {
      setLoading(null);
    }
  };

  const handleTimeIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    handleSubmit("timein", {
      employeeId: form.get("employeeId") as string,
      projectSiteId: form.get("projectSiteId") as string || null,
      date: form.get("date") as string,
      timeIn: form.get("timeIn") as string,
    });
  };

  const handleTimeOut = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    handleSubmit("timeout", {
      employeeId: form.get("employeeId") as string,
      date: form.get("date") as string,
      timeOut: form.get("timeOut") as string,
    });
  };

  const handleStatus = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const status = (form.get("status") as string) || "PRESENT";
    // Day Type is a separate selector: Holiday (double pay) or Special Holiday
    // (130% pay) registers the date in the Holiday table so payroll adds the
    // premium automatically. The employee keeps their normal status.
    const holidayType = form.get("holidayType") as string | null;
    handleSubmit("status", {
      employeeId: form.get("employeeId") as string,
      projectSiteId: form.get("projectSiteId") as string || null,
      date: form.get("date") as string,
      status,
      holidayType: holidayType === "REGULAR" || holidayType === "SPECIAL" ? holidayType : null,
      timeIn: form.get("timeIn") as string || null,
      timeOut: form.get("timeOut") as string || null,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Log Attendance</h2>

      {message && (
        <div className={`text-sm rounded-lg px-4 py-3 mb-4 ${
          isError ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"
        }`}>
          {message}
        </div>
      )}

      <div className="space-y-6">
        {/* Quick Present/Absent Toggle */}
        <div className="border border-slate-200 rounded-xl p-4">
          <h3 className="font-medium text-slate-700 text-sm mb-3">Quick Mark</h3>
          <p className="text-xs text-slate-500 mb-4">Just mark Present or Absent — time calculations are automatic</p>

          <form onSubmit={handleStatus} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select name="employeeId" required className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="">Select Employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.employeeNumber} - {e.firstName} {e.lastName}</option>
              ))}
            </select>
            <input type="date" name="date" required defaultValue={new Date().toISOString().split("T")[0]} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <select name="projectSiteId" className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="">Select Site (optional)</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select name="status" className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="PRESENT">✅ Present</option>
                <option value="HALF_DAY">🌅 Half Day</option>
                <option value="ABSENT">❌ Absent</option>
              </select>
              <select name="holidayType" defaultValue="" className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="">Day Type: Regular Day</option>
                <option value="REGULAR">🎉 Day Type: Holiday (double pay)</option>
                <option value="SPECIAL">🎊 Day Type: Special Holiday (130% pay)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading !== null}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 md:col-span-2"
            >
              {loading !== null ? "Saving..." : "Mark"}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time In */}
          <form onSubmit={handleTimeIn} className="space-y-3">
            <h3 className="font-medium text-slate-700 text-sm">Time In (with auto calc)</h3>
            <div className="grid grid-cols-2 gap-3">
              <select name="employeeId" required className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.employeeNumber} - {e.firstName} {e.lastName}</option>
                ))}
              </select>
              <input type="date" name="date" required defaultValue={new Date().toISOString().split("T")[0]} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <select name="projectSiteId" className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="">Select Site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input type="time" name="timeIn" required defaultValue={new Date().toTimeString().slice(0, 5)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <button
              type="submit"
              disabled={loading !== null}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading !== null ? "Saving..." : "⏰ Log Time-In"}
            </button>
          </form>

          {/* Time Out */}
          <form onSubmit={handleTimeOut} className="space-y-3">
            <h3 className="font-medium text-slate-700 text-sm">Time Out (with auto calc)</h3>
            <div className="grid grid-cols-2 gap-3">
              <select name="employeeId" required className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.employeeNumber} - {e.firstName} {e.lastName}</option>
                ))}
              </select>
              <input type="date" name="date" required defaultValue={new Date().toISOString().split("T")[0]} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input type="time" name="timeOut" required defaultValue={new Date().toTimeString().slice(0, 5)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <button
              type="submit"
              disabled={loading !== null}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading !== null ? "Saving..." : "🏁 Log Time-Out"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
