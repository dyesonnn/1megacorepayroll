"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ComputePayrollButtonProps {
  periodId: string;
  periodStatus: string;
}

export default function ComputePayrollButton({ periodId, periodStatus }: ComputePayrollButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [includeOvertime, setIncludeOvertime] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const startCompute = () => {
    setShowConfirm(false);
    setLoading(true);
    setMessage("");

    fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "computePayroll", periodId, includeOvertime }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error || "Failed to compute payroll");
          setIsError(true);
          return;
        }

        setMessage(
          includeOvertime
            ? `Payroll computed for ${data.count} employees!`
            : `Payroll computed for ${data.count} employees (OT pay excluded).`
        );
        setIsError(false);
        router.refresh();
      })
      .catch(() => {
        setMessage("Connection error");
        setIsError(true);
      })
      .finally(() => setLoading(false));
  };

  const handleCompute = () => {
    // Warn when the user is about to compute without OT pay
    if (!includeOvertime) {
      setShowConfirm(true);
      return;
    }
    startCompute();
  };

  if (periodStatus === "PAID") return null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <label
          className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none"
          title="Uncheck to compute this payroll without OT pay (e.g. due to lack of funds)"
        >
          <input
            type="checkbox"
            checked={includeOvertime}
            onChange={(e) => setIncludeOvertime(e.target.checked)}
            className="accent-emerald-600"
          />
          Include OT Pay
        </label>
        <button
          onClick={handleCompute}
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Computing..." : "⚙️ Compute Payroll"}
        </button>
      </div>
      {message && (
        <p className={`text-xs mt-2 ${isError ? "text-red-600" : "text-green-600"}`}>
          {message}
        </p>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-900 mb-2">Exclude OT Pay?</h3>
            <p className="text-sm text-slate-600 mb-5">
              Overtime hours will still be tracked in attendance, but <span className="font-medium">no OT pay will be added</span> to any employee&apos;s payroll for this period.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={startCompute}
                disabled={loading}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? "Computing..." : "Compute without OT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
