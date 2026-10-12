"use client";

import { formatPeso } from "@/lib/utils";

export interface DepartmentTotals {
  departmentId: string;
  departmentName: string;
  /** Distinct employees with at least one record in the period range. */
  employees: number;
  gross: number;
  deductions: number;
  net: number;
  /** Cash advances recovered through these records. */
  cashAdvances: number;
  paidCount: number;
  recordCount: number;
}

interface PayrollSummaryProps {
  rows: DepartmentTotals[];
  periodCount: number;
}

/**
 * Totals per department/company across the payroll periods. Each company
 * (1MEGACORE, 1MPRL, Pauline's, ...) is a department here, so this is the
 * view that adds up what each entity was actually paid.
 */
export default function PayrollSummary({ rows, periodCount }: PayrollSummaryProps) {
  const totals = rows.reduce(
    (acc, r) => ({
      employees: acc.employees + r.employees,
      gross: acc.gross + r.gross,
      deductions: acc.deductions + r.deductions,
      net: acc.net + r.net,
      cashAdvances: acc.cashAdvances + r.cashAdvances,
      paidCount: acc.paidCount + r.paidCount,
      recordCount: acc.recordCount + r.recordCount,
    }),
    { employees: 0, gross: 0, deductions: 0, net: 0, cashAdvances: 0, paidCount: 0, recordCount: 0 }
  );

  const unpaidNote = totals.recordCount - totals.paidCount;

  return (
    <section className="bg-white rounded-xl border border-slate-200 mb-6 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">Payroll Summary by Department</h2>
        <p className="text-xs text-slate-500 mt-1">
          {periodCount === 0
            ? "No payroll periods yet."
            : `Totals across ${periodCount} payroll period${periodCount !== 1 ? "s" : ""}.`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          Run a payroll to see totals by department.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 text-left font-medium">Department / Company</th>
                  <th className="px-4 py-3 text-right font-medium">Employees</th>
                  <th className="px-4 py-3 text-right font-medium">Gross Pay</th>
                  <th className="px-4 py-3 text-right font-medium">Deductions</th>
                  <th className="px-4 py-3 text-right font-medium">Cash Adv.</th>
                  <th className="px-4 py-3 text-right font-medium">Net Pay</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.departmentId} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.departmentName}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.employees}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPeso(row.gross)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPeso(row.deductions)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {row.cashAdvances > 0 ? formatPeso(row.cashAdvances) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatPeso(row.net)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {row.paidCount}/{row.recordCount}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold text-slate-900">
                  <td className="px-4 py-3">
                    All departments
                    {unpaidNote > 0 && (
                      <span className="ml-2 text-xs font-normal text-amber-700">
                        {unpaidNote} unpaid record{unpaidNote !== 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{totals.employees}</td>
                  <td className="px-4 py-3 text-right">{formatPeso(totals.gross)}</td>
                  <td className="px-4 py-3 text-right">{formatPeso(totals.deductions)}</td>
                  <td className="px-4 py-3 text-right">
                    {totals.cashAdvances > 0 ? formatPeso(totals.cashAdvances) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-700">{formatPeso(totals.net)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {totals.paidCount}/{totals.recordCount}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Phone: one card per department */}
          <div className="sm:hidden divide-y divide-slate-100">
            {rows.map((row) => (
              <div key={row.departmentId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{row.departmentName}</p>
                    <p className="text-xs text-slate-500">
                      {row.employees} employee{row.employees !== 1 ? "s" : ""} · {row.paidCount}/{row.recordCount} paid
                    </p>
                  </div>
                  <p className="font-semibold text-blue-700">{formatPeso(row.net)}</p>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Gross</dt>
                    <dd className="text-slate-700">{formatPeso(row.gross)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Deductions</dt>
                    <dd className="text-slate-700">{formatPeso(row.deductions)}</dd>
                  </div>
                  {row.cashAdvances > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Cash adv.</dt>
                      <dd className="text-slate-700">{formatPeso(row.cashAdvances)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            ))}
            <div className="px-4 py-3 bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">All departments</p>
                  <p className="text-xs text-slate-500">
                    {totals.employees} employees · {totals.paidCount}/{totals.recordCount} paid
                  </p>
                </div>
                <p className="font-semibold text-blue-700">{formatPeso(totals.net)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
