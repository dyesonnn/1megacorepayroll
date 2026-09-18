"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
}

interface HolidayManagerProps {
  holidays: Holiday[];
}

export default function HolidayManager({ holidays: initialHolidays }: HolidayManagerProps) {
  const router = useRouter();
  const [holidays, setHolidays] = useState(initialHolidays);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", type: "REGULAR" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.date) return;

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to add holiday");
        setIsError(true);
        return;
      }

      setMessage("Holiday added!");
      setIsError(false);
      setForm({ name: "", date: "", type: "REGULAR" });
      router.refresh();
    } catch {
      setMessage("Connection error");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this holiday?")) return;

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await fetch(`/api/holidays/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Failed to delete holiday");
        setIsError(true);
        return;
      }

      setMessage("Holiday removed");
      setIsError(false);
      router.refresh();
    } catch {
      setMessage("Connection error");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {message && (
        <div className={`text-sm rounded-lg px-4 py-3 mb-4 ${
          isError ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Holiday Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Add New Holiday</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Holiday Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Christmas Day"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Holiday Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="REGULAR">Regular — 200% if worked, paid even if not worked</option>
                <option value="SPECIAL">Special Non-Working — 130% if worked, no pay if not</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Rates follow Philippine labor law (DOLE). Payroll applies these automatically.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Holiday"}
            </button>
          </form>
        </div>

        {/* Holiday List */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Holidays</h2>
          {holidays.length === 0 ? (
            <p className="text-slate-500 text-sm">No holidays added yet</p>
          ) : (
            <div className="space-y-2">
              {holidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 text-sm">{holiday.name}</p>
                      {holiday.type === "SPECIAL" ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">SPECIAL</span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">REGULAR</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{formatDate(holiday.date)}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(holiday.id)}
                    className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
