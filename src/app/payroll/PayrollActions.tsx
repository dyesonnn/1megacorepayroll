"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { normalizeForSearch } from "@/lib/utils";

interface PayrollActionsProps {
  totalActiveEmployees: number;
  departments: { id: string; name: string; activeEmployees: number }[];
  roster: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    departmentName: string;
  }[];
}

/** ALL = everyone with attendance, DEPARTMENT = one department, SELECTED = hand-picked. */
type ScopeType = "ALL" | "DEPARTMENT" | "SELECTED";

export default function PayrollActions({ totalActiveEmployees, departments, roster }: PayrollActionsProps) {
  const router = useRouter();
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // Scope for the period being created. Defaults to everyone, so the plain
  // "create a payroll" flow is unchanged.
  const [scopeType, setScopeType] = useState<ScopeType>("ALL");
  const [departmentId, setDepartmentId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rosterQuery, setRosterQuery] = useState("");

  const searchWords = normalizeForSearch(rosterQuery).split(/\s+/).filter(Boolean);
  const matchedRoster = searchWords.length
    ? roster.filter((e) => {
        const haystack = normalizeForSearch(
          `${e.firstName} ${e.lastName} ${e.employeeNumber} ${e.departmentName}`
        );
        return searchWords.every((word) => haystack.includes(word));
      })
    : roster;

  const toggleEmployee = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const chosenDepartment = departments.find((d) => d.id === departmentId);

  const resetCreateForm = () => {
    setShowCreatePeriod(false);
    setScopeType("ALL");
    setDepartmentId("");
    setSelectedIds([]);
    setRosterQuery("");
  };

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
          scopeType,
          departmentId: scopeType === "DEPARTMENT" ? departmentId : null,
          employeeIds: scopeType === "SELECTED" ? selectedIds : [],
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
      resetCreateForm();
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
        <Link
          href="/payroll/payslips"
          className="px-4 py-2 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
        >
          🖨️ Print Payslips
        </Link>
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
          {/* Who this payroll covers. Scoped payrolls live beside the
              all-employees payroll instead of replacing it. */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Who gets paid</label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "ALL", label: "All employees" },
                { value: "DEPARTMENT", label: "One department" },
                { value: "SELECTED", label: "Selected employees" },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScopeType(option.value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    scopeType === option.value
                      ? "bg-blue-50 border-blue-500 text-blue-700 font-medium"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-500 mt-2">
              {scopeType === "ALL" &&
                `Everyone with attendance in the period gets a row — the usual all-employees payroll.`}
              {scopeType === "DEPARTMENT" &&
                "Everyone in the department is listed, at ₱0 when they have no attendance in the period."}
              {scopeType === "SELECTED" &&
                "Only the employees you pick below are listed, at ₱0 when they have no attendance in the period."}
            </p>

            {scopeType === "DEPARTMENT" && (
              <div className="mt-3">
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  required
                  className="w-full sm:w-80 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.activeEmployees} active)
                    </option>
                  ))}
                </select>
                {chosenDepartment && (
                  <p className="text-xs text-slate-500 mt-2">
                    This payroll will cover {chosenDepartment.activeEmployees} active employee
                    {chosenDepartment.activeEmployees !== 1 ? "s" : ""} in {chosenDepartment.name}.
                  </p>
                )}
              </div>
            )}

            {scopeType === "SELECTED" && (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={rosterQuery}
                    onChange={(e) => setRosterQuery(e.target.value)}
                    placeholder="Search employees by name or number…"
                    aria-label="Search employees to include in this payroll"
                    className="w-full sm:w-72 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                  <span className="text-xs text-slate-500">{selectedIds.length} selected</span>
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                      Clear
                    </button>
                  )}
                  {matchedRoster.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds((prev) => [
                          ...new Set([...prev, ...matchedRoster.map((e) => e.id)]),
                        ])
                      }
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Select all {searchWords.length ? "matching" : ""} ({matchedRoster.length})
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {matchedRoster.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">No matching employee</p>
                  ) : (
                    matchedRoster.map((employee) => (
                      <label
                        key={employee.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(employee.id)}
                          onChange={() => toggleEmployee(employee.id)}
                          className="h-4 w-4 accent-blue-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-slate-900">
                            {employee.firstName} {employee.lastName}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {employee.employeeNumber} · {employee.departmentName}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
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
              onClick={resetCreateForm}
              className="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Info */}
      <p className="text-xs text-slate-500 mt-3">
        {totalActiveEmployees} active employees. The usual payroll covers everyone with attendance;
        a department or selected payroll covers just those people.
      </p>
    </div>
  );
}
