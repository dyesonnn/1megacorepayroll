"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface EmployeeActionsProps {
  employeeId: string;
  employeeName: string;
}

export default function EmployeeActions({ employeeId, employeeName }: EmployeeActionsProps) {
  const router = useRouter();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleArchive = async () => {
    setLoading(true);
    try {
      await fetch(`/api/employees?id=${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employmentStatus: "ARCHIVED" }),
      });
      router.refresh();
    } finally {
      setLoading(false);
      setShowArchiveConfirm(false);
    }
  };

  const handleReactivate = async () => {
    setLoading(true);
    try {
      await fetch(`/api/employees?id=${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employmentStatus: "ACTIVE" }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <a
        href={`/employees/${employeeId}/edit`}
        className="px-3 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg hover:bg-blue-100 transition-colors"
      >
        ✏️ Edit
      </a>
      <button
        onClick={handleReactivate}
        className="px-3 py-2 bg-green-50 text-green-700 text-sm rounded-lg hover:bg-green-100 transition-colors"
      >
        Reactivate
      </button>
      <button
        onClick={() => setShowArchiveConfirm(true)}
        className="px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg hover:bg-red-100 transition-colors"
      >
        Archive
      </button>

      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Archive Employee?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to archive {employeeName}? They will no longer appear in active employee lists.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={loading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
