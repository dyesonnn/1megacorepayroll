"use client";

import { useState } from "react";
import { PH_TZ } from "@/lib/utils";
import EmployeePicker from "@/components/EmployeePicker";

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  dailyRate: number;
}

interface CashAdvance {
  id: string;
  employeeId: string;
  amount: number;
  advanceDate: string;
  description: string | null;
  status: string;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
  };
  payrollRecord?: { id: string; paid: boolean } | null;
}

interface CashAdvanceManagerProps {
  employees: Employee[];
  initialAdvances: CashAdvance[];
}

export default function CashAdvanceManager({ employees, initialAdvances }: CashAdvanceManagerProps) {
  const [advances, setAdvances] = useState(initialAdvances);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formAmount, setFormAmount] = useState<string>("");

  const outstandingFor = (employeeId: string) =>
    advances
      .filter((a) => a.employeeId === employeeId && a.status === "PENDING")
      .reduce((sum, a) => sum + a.amount, 0);

  const formatPeso = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-PH", {
      timeZone: PH_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Deducted in a payroll that is already marked paid — the money is settled,
  // so the advance has to stay as the record of it.
  const isDeleteLocked = (advance: CashAdvance) =>
    advance.status === "DEDUCTED" && advance.payrollRecord?.paid === true;

  const query = search.trim().toLowerCase();

  const filteredAdvances = advances.filter((a) => {
    if (filterEmployee && a.employeeId !== filterEmployee) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (query) {
      const haystack = `${a.employee.firstName} ${a.employee.lastName} ${a.employee.employeeNumber} ${a.description ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const hasFilters = query !== "" || filterEmployee !== "" || filterStatus !== "";

  const totalPending = filteredAdvances
    .filter((a) => a.status === "PENDING")
    .reduce((sum, a) => sum + a.amount, 0);

  const totalDeducted = filteredAdvances
    .filter((a) => a.status === "DEDUCTED")
    .reduce((sum, a) => sum + a.amount, 0);

  const totalOutstanding = advances
    .filter((a) => a.status === "PENDING")
    .reduce((sum, a) => sum + a.amount, 0);

  const formOutstanding = formEmployeeId ? outstandingFor(formEmployeeId) : 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);

    // The picker carries the id in a hidden field, which the browser cannot
    // mark as required — so a half-typed name is caught here rather than
    // being sent as an empty employee.
    const employeeId = form.get("employeeId");
    if (!employeeId) {
      setError("Choose an employee from the list");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/cash-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          amount: parseFloat(form.get("amount") as string),
          advanceDate: form.get("advanceDate"),
          description: form.get("description") || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create cash advance");
        return;
      }

      const newAdvance = await res.json();
      setAdvances([newAdvance, ...advances]);
      setShowForm(false);
      setFormEmployeeId("");
      setFormAmount("");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this cash advance? It stays in the list as CANCELLED and is no longer counted."))
      return;

    setNotice("");
    setLoading(true);
    try {
      const res = await fetch(`/api/cash-advances?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to cancel cash advance");
        return;
      }
      setAdvances(advances.map((a) => (a.id === id ? { ...a, status: "CANCELLED" } : a)));
    } catch {
      alert("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (advance: CashAdvance) => {
    const who = `${advance.employee.firstName} ${advance.employee.lastName}`;
    const deducted = advance.status === "DEDUCTED";
    if (
      !confirm(
        `Permanently delete this ${formatPeso(advance.amount)} cash advance of ${who}?\n\n` +
          (deducted
            ? "It was already deducted in this payroll, so its amount is also removed from that payslip (net pay goes up). " +
              "This cannot be undone."
            : "It will be removed from the list, the totals, and the monthly sheet. This cannot be undone.")
      )
    )
      return;

    setNotice("");
    setLoading(true);
    try {
      const res = await fetch(`/api/cash-advances?id=${advance.id}&permanent=true`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || "Failed to delete cash advance");
        return;
      }
      setAdvances(advances.filter((a) => a.id !== advance.id));
    } catch {
      setNotice("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    DEDUCTED: "bg-green-100 text-green-700",
    CANCELLED: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{formatPeso(totalPending)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Deducted</p>
          <p className="text-2xl font-bold text-green-600">{formatPeso(totalDeducted)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Outstanding</p>
          <p className="text-2xl font-bold text-orange-500">{formatPeso(totalOutstanding)}</p>
          <p className="text-xs text-slate-400 mt-1">Pending recovery via payroll</p>
        </div>
      </div>

      {/* Filters & Add Button */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-sm text-slate-600 mb-1">Search</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, employee no., or description"
                className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {search !== "" && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="block text-sm text-slate-600 mb-1">Filter by Employee</label>
            {/* Type to find the employee instead of scrolling the whole
                roster — same picker the attendance marking forms use. */}
            <EmployeePicker
              employees={employees}
              name="filterEmployee"
              placeholder="All employees — type a name or number…"
              onSelect={(emp) => setFilterEmployee(emp?.id ?? "")}
            />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm text-slate-600 mb-1">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="DEDUCTED">Deducted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilterEmployee("");
                  setFilterStatus("");
                }}
                className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Cash Advance
            </button>
          </div>
        </div>

        {notice && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mt-4">
            {notice}
          </div>
        )}

        {hasFilters && (
          <p className="text-xs text-slate-500 mt-3">
            Showing {filteredAdvances.length} of {advances.length} cash advance{advances.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Add Cash Advance</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
                {/* Type-to-search, like the attendance marking form — the
                    chosen id still submits through the employeeId field. */}
                <EmployeePicker
                  employees={employees}
                  onSelect={(emp) => setFormEmployeeId(emp?.id ?? "")}
                />
                {formEmployeeId && (
                  <p className="text-xs mt-1 text-slate-400">
                    Outstanding: {formatPeso(formOutstanding)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₱)</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Advance</label>
                <input
                  type="date"
                  name="advanceDate"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">When was the cash advance given?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  name="description"
                  placeholder="e.g., Emergency, Medical, etc."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Adding..." : "Add Cash Advance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advances List */}
      {filteredAdvances.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-slate-400 text-4xl mb-4">💰</div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No cash advances found</h3>
          <p className="text-slate-500">
            {hasFilters
              ? "No cash advances match your search or filters"
              : "Add a cash advance to get started"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left font-medium text-slate-700">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Description</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdvances.map((advance) => (
                <tr key={advance.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {advance.employee.firstName} {advance.employee.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{advance.employee.employeeNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(advance.advanceDate)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatPeso(advance.amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{advance.description || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[advance.status]}`}>
                      {advance.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {advance.status !== "DEDUCTED" && (
                        <button
                          onClick={() => handleCancel(advance.id)}
                          disabled={loading}
                          title="Keep the record but stop counting it"
                          className="px-3 py-1 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(advance)}
                        disabled={loading || isDeleteLocked(advance)}
                        title={
                          isDeleteLocked(advance)
                            ? "Deducted in a payroll already marked paid — it stays as a record of the money recovered"
                            : advance.status === "DEDUCTED"
                              ? "Remove this advance and its deduction from the payroll"
                              : "Remove this cash advance completely"
                        }
                        className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                      >
                        🗑️ Delete
                      </button>
                      {isDeleteLocked(advance) && (
                        <span className="text-xs text-slate-400">Paid — locked</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
