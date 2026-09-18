"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CashAdvanceSettingsFormProps {
  initialLimit: number;
  initialMaxNetFraction: number;
}

export default function CashAdvanceSettingsForm({
  initialLimit,
  initialMaxNetFraction,
}: CashAdvanceSettingsFormProps) {
  const router = useRouter();
  const [limit, setLimit] = useState(String(initialLimit));
  const [maxNetPercent, setMaxNetPercent] = useState(String(Math.round(initialMaxNetFraction * 100)));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await fetch("/api/cash-advances/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashAdvanceLimit: parseFloat(limit),
          cashAdvanceMaxNetFraction: (parseFloat(maxNetPercent) || 0) / 100,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to save settings");
        setIsError(true);
        return;
      }

      setMessage("Settings saved.");
      router.refresh();
    } catch {
      setMessage("Connection error. Please try again.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            isError
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Maximum outstanding cash advance per employee (₱)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">
            New advances are rejected when an employee&apos;s total Pending advances would exceed this amount.
            Deducted advances no longer count.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Max share of gross pay consumable by advance deductions (%)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              required
              value={maxNetPercent}
              onChange={(e) => setMaxNetPercent(e.target.value)}
              className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <span className="text-sm text-slate-600">%</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            When deducting cash advances in payroll, the oldest advances are deducted first and
            deduction stops once this share of gross pay is reached. The rest stays Pending for the
            next payroll.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
