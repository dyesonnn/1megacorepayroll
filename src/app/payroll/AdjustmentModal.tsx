"use client";

import { useState, useEffect } from "react";

interface PayrollRecord {
  id: string;
  employeeNumber: string;
  employeeName: string;
  employeeId: string;
  basicPay: number;
  overtimePay: number;
  holidayPay: number;
  allowances: number;
  bonuses: number;
  doublePay: number;
  grossPay: number;
  sssDeduction: number;
  philhealthDeduction: number;
  pagibigDeduction: number;
  withholdingTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  daysWorked: number;
  paid: boolean;
}

interface CashAdvance {
  id: string;
  amount: number;
  advanceDate: string;
  description: string | null;
  status: string;
}

interface AdjustmentModalProps {
  record: PayrollRecord;
  onClose: () => void;
  onSave: (updatedRecord: PayrollRecord) => void;
}

export default function AdjustmentModal({ record, onClose, onSave }: AdjustmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingAdvances, setPendingAdvances] = useState<CashAdvance[]>([]);
  const [selectedAdvances, setSelectedAdvances] = useState<string[]>([]);
  const [maxNetFraction, setMaxNetFraction] = useState(0.5);

  // Additions
  const [allowances, setAllowances] = useState(record.allowances);
  const [bonuses, setBonuses] = useState(record.bonuses);
  const [doublePay, setDoublePay] = useState(record.doublePay);

  // Government deductions (manual)
  const [sssDeduction, setSssDeduction] = useState(record.sssDeduction);
  const [philhealthDeduction, setPhilhealthDeduction] = useState(record.philhealthDeduction);
  const [pagibigDeduction, setPagibigDeduction] = useState(record.pagibigDeduction);

  // Other deductions (manual)
  const [withholdingTax, setWithholdingTax] = useState(record.withholdingTax);
  const [otherDeductions, setOtherDeductions] = useState(record.otherDeductions);

  // Fetch pending cash advances for this employee + the system cap setting
  useEffect(() => {
    if (record.employeeId) {
      fetch(`/api/cash-advances?employeeId=${record.employeeId}&status=PENDING`)
        .then((res) => res.json())
        .then((data) => setPendingAdvances(Array.isArray(data) ? data : []))
        .catch(() => setPendingAdvances([]));
    }
    fetch("/api/cash-advances/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.cashAdvanceMaxNetFraction === "number") {
          setMaxNetFraction(data.cashAdvanceMaxNetFraction);
        }
      })
      .catch(() => {});
  }, [record.employeeId]);

  const formatPeso = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const totalSelectedAdvanceAmount = pendingAdvances
    .filter((a) => selectedAdvances.includes(a.id))
    .reduce((sum, a) => sum + a.amount, 0);

  // Cash advance deductions may consume at most this fraction of gross pay
  // (matches the server-side cap — oldest advances are deducted first)
  const maxAdvanceBudget = record.grossPay * maxNetFraction;
  const previouslyDeductedTotal = record.totalDeductions - (
    record.sssDeduction + record.philhealthDeduction + record.pagibigDeduction +
    record.withholdingTax + record.otherDeductions
  );
  const remainingAdvanceBudget = Math.max(0, maxAdvanceBudget - Math.max(0, previouslyDeductedTotal));
  const overCapAmount = Math.max(0, totalSelectedAdvanceAmount - remainingAdvanceBudget);

  const advanceBudgetExceeded = overCapAmount > 0;

  const selectWithinBudget = (ids: string[]) => {
    // Oldest first — matches server-side order
    const ordered = pendingAdvances
      .filter((a) => ids.includes(a.id))
      .sort((a, b) => new Date(a.advanceDate).getTime() - new Date(b.advanceDate).getTime());
    let budget = remainingAdvanceBudget;
    const kept: string[] = [];
    for (const a of ordered) {
      if (a.amount <= budget) {
        budget -= a.amount;
        kept.push(a.id);
      }
    }
    return kept;
  };

  const calculateNewTotals = () => {
    const grossPay = record.basicPay + record.overtimePay + record.holidayPay + allowances + bonuses + doublePay;
    // Include advances already deducted through this record, not just newly selected ones
    const totalDeductions = sssDeduction + philhealthDeduction + pagibigDeduction + withholdingTax + otherDeductions + Math.max(0, previouslyDeductedTotal) + totalSelectedAdvanceAmount;
    const netPay = grossPay - totalDeductions;
    return { grossPay, totalDeductions, netPay };
  };

  const { grossPay, totalDeductions, netPay } = calculateNewTotals();

  const toggleAdvance = (id: string) => {
    setSelectedAdvances((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : selectWithinBudget([...prev, id])
    );
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");

    try {
      // Save adjustments
      const res = await fetch("/api/payroll/adjustments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: record.id,
          adjustments: {
            allowances,
            bonuses,
            doublePay,
            sssDeduction,
            philhealthDeduction,
            pagibigDeduction,
            withholdingTax,
            otherDeductions,
            selectedAdvanceIds: selectedAdvances,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save adjustments");
        return;
      }

      const updated = await res.json();
      onSave({
        ...record,
        ...updated,
        employeeName: record.employeeName,
        employeeNumber: record.employeeNumber,
        employeeId: record.employeeId,
      });
      onClose();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Payroll Adjustments</h2>
            <p className="text-sm text-slate-500">{record.employeeName} ({record.employeeNumber})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Current Earnings */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Current Earnings</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Basic Pay:</span>
                <span className="font-medium">{formatPeso(record.basicPay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Overtime:</span>
                <span className="font-medium">{formatPeso(record.overtimePay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Holiday:</span>
                <span className="font-medium">{formatPeso(record.holidayPay)}</span>
              </div>
            </div>
          </div>

          {/* Additions */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">➕ Additions</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Allowances</label>
                <input
                  type="number"
                  value={allowances}
                  onChange={(e) => setAllowances(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Bonuses</label>
                <input
                  type="number"
                  value={bonuses}
                  onChange={(e) => setBonuses(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Performance, 13th month, etc.</p>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Double Pay (Holiday)</label>
                <input
                  type="number"
                  value={doublePay}
                  onChange={(e) => setDoublePay(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Extra holiday premium on top of auto-computed holiday pay (e.g., holiday fallen on a rest day)</p>
              </div>
            </div>
          </div>

          {/* Manual Tax & Deductions */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">🏛️ Tax & Deductions (Manual)</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Withholding Tax</label>
                <input
                  type="number"
                  value={withholdingTax}
                  onChange={(e) => setWithholdingTax(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Enter the exact tax amount</p>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Other Deductions</label>
                <input
                  type="number"
                  value={otherDeductions}
                  onChange={(e) => setOtherDeductions(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Loans, damages, etc.</p>
              </div>
            </div>
          </div>

          {/* Government Deductions (Manual) */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">🏛️ Government Contributions</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">SSS</label>
                <input
                  type="number"
                  value={sssDeduction}
                  onChange={(e) => setSssDeduction(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">PhilHealth</label>
                <input
                  type="number"
                  value={philhealthDeduction}
                  onChange={(e) => setPhilhealthDeduction(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Pag-IBIG</label>
                <input
                  type="number"
                  value={pagibigDeduction}
                  onChange={(e) => setPagibigDeduction(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Cash Advances (Dated) */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">💰 Cash Advances (Pending)</h3>
            {pendingAdvances.length === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">No pending cash advances for this employee.</p>
            ) : (
              <div className="space-y-2">
                {pendingAdvances.map((advance) => (
                  <label
                    key={advance.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAdvances.includes(advance.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedAdvances.includes(advance.id)}
                        onChange={() => toggleAdvance(advance.id)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {formatPeso(advance.amount)}
                        </p>
                        <p className="text-xs text-slate-500">
                          📅 {formatDate(advance.advanceDate)}
                          {advance.description && ` • ${advance.description}`}
                        </p>
                      </div>
                    </div>
                    {selectedAdvances.includes(advance.id) && (
                      <span className="text-xs text-blue-600 font-medium">✓ Will deduct</span>
                    )}
                  </label>
                ))}
                {(totalSelectedAdvanceAmount > 0 || advanceBudgetExceeded) && (
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      advanceBudgetExceeded
                        ? "bg-red-50 border border-red-200"
                        : "bg-yellow-50 border border-yellow-200"
                    }`}
                  >
                    <span
                      className={`font-medium ${
                        advanceBudgetExceeded ? "text-red-700" : "text-yellow-700"
                      }`}
                    >
                      Total Cash Advances to Deduct: {formatPeso(totalSelectedAdvanceAmount)}
                    </span>
                    <p className={`text-xs mt-1 ${advanceBudgetExceeded ? "text-red-600" : "text-yellow-600"}`}>
                      Cap for this payroll: {formatPeso(remainingAdvanceBudget)} remaining (max
                      {" "}{Math.round(maxNetFraction * 100)}% of gross pay). Oldest advances deduct first.
                      {advanceBudgetExceeded &&
                        ` ${formatPeso(overCapAmount)} will stay Pending for the next payroll.`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">📊 Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Gross Pay:</span>
                <span className="font-semibold text-green-700">{formatPeso(grossPay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Deductions:</span>
                <span className="font-semibold text-red-700">{formatPeso(totalDeductions)}</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-2">
                <span className="font-medium text-slate-900">Net Pay:</span>
                <span className="font-bold text-lg text-slate-900">{formatPeso(netPay)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving..." : "Save Adjustments"}
          </button>
        </div>
      </div>
    </div>
  );
}
