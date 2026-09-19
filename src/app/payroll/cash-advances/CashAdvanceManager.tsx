"use client";

import { useState } from "react";
import { PH_TZ } from "@/lib/utils";

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
}

interface CashAdvanceManagerProps {
  employees: Employee[];
  initialAdvances: CashAdvance[];
  advanceLimit: number;
}

export default function CashAdvanceManager({ employees, initialAdvances, advanceLimit }: CashAdvanceManagerProps) {
  const [advances, setAdvances] = useState(initialAdvances);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  const filteredAdvances = advances.filter((a) => {
    if (filterEmployee && a.employeeId !== filterEmployee) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    return true;
  });

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
  const formAvailable = Math.max(0, advanceLimit - formOutstanding);
  const formAmountNum = parseFloat(formAmount) || 0;
  const formWouldExceed = formEmployeeId !== "" && formAmountNum > 0 && formAmountNum > formAvailable;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/cash-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.get("employeeId"),
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
    if (!confirm("Are you sure you want to cancel this cash advance?")) return;

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
          <p className="text-xs text-slate-400 mt-1">Pending recovery via payroll · limit {formatPeso(advanceLimit)}/employee</p>
        </div>
      </div>

      {/* Filters & Add Button */}        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-slate-600 mb-1">Filter by Employee</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeNumber} - {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
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
            <a
              href="/payroll/cash-advances/settings"
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              ⚙️ Settings
            </a>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Cash Advance
            </button>
          </div>
        </div>
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
                <select
                  name="employeeId"
                  required
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeNumber} - {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
                {formEmployeeId && (
                  <p className={`text-xs mt-1 ${formWouldExceed ? "text-red-600" : "text-slate-400"}`}>
                    Outstanding: {formatPeso(formOutstanding)} · Limit: {formatPeso(advanceLimit)} · Available:{" "}
                    <span className={formWouldExceed ? "font-semibold" : ""}>{formatPeso(formAvailable)}</span>
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
                  className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 ${
                    formWouldExceed
                      ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                      : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {formWouldExceed && (
                  <p className="text-xs text-red-600 mt-1">
                    Exceeds the ₱{advanceLimit.toLocaleString("en-PH")} limit — this advance will be rejected.
                  </p>
                )}
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
                  disabled={loading || formWouldExceed}
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
          <p className="text-slate-500">Add a cash advance to get started</p>
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
                    {advance.status === "PENDING" && (
                      <button
                        onClick={() => handleCancel(advance.id)}
                        disabled={loading}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
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
