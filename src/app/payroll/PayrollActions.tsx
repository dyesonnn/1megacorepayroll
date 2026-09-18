"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PayrollActionsProps {
  totalActiveEmployees: number;
}

export default function PayrollActions({ totalActiveEmployees }: PayrollActionsProps) {
  const router = useRouter();
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleCreatePeriod = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "createPeriod",
          name: form.get("name"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
          payDate: form.get("payDate"),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to create period");
        setIsError(true);
        return;
      }

      setMessage("Payroll period created! Now run payroll computation.");
      setIsError(false);
      setShowCreatePeriod(false);
      router.refresh();
    } catch {
      setMessage("Connection error");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleComputePayroll = async (periodId: string) => {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "computePayroll", periodId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to compute payroll");
        setIsError(true);
        return;
      }

      setMessage(`Payroll computed for ${data.count} employees!`);
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
    <div className="mb-6">
      {message && (
        <div className={`text-sm rounded-lg px-4 py-3 mb-4 ${
          isError ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"
        }`}>
          {message}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setShowCreatePeriod(!showCreatePeriod)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Create Payroll Period
        </button>
      </div>

      {showCreatePeriod && (
        <form onSubmit={handleCreatePeriod} className="mt-4 bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">New Payroll Period</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Period Name</label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g., August 1-15, 2026"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input type="date" name="startDate" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input type="date" name="endDate" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pay Date</label>
              <input type="date" name="payDate" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Period"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreatePeriod(false)}
              className="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Info */}
      <p className="text-xs text-slate-500 mt-3">
        {totalActiveEmployees} active employees will be included in payroll computation.
      </p>
    </div>
  );
}
