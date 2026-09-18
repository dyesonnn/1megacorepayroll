"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeletePeriodButtonProps {
  periodId: string;
  periodName: string;
}

export default function DeletePeriodButton({ periodId, periodName }: DeletePeriodButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleDelete = async () => {
    const confirmed = confirm(
      `Delete payroll period "${periodName}"?\n\nThis permanently removes the period and all its payroll records. Cash advances that were deducted through it will go back to Pending.`
    );
    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "deletePeriod", periodId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to delete period");
        setIsError(true);
        return;
      }

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
      <button
        onClick={handleDelete}
        disabled={loading}
        className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
        title="Delete this payroll period"
      >
        {loading ? "Deleting..." : "🗑 Delete"}
      </button>
      {message && (
        <p className={`text-xs mt-2 ${isError ? "text-red-600" : "text-green-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
