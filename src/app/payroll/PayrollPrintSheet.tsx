"use client";

import { createPortal } from "react-dom";
import { formatPeso, formatDateTime, PH_TZ } from "@/lib/utils";

/**
 * The money columns of one employee's row, which is all the printed sheet
 * needs — a `PayrollRecord` satisfies this structurally.
 */
export interface PayrollPrintRecord {
  employeeNumber: string;
  employeeName: string;
  daysWorked: number;
  basicPay: number;
  overtimePay: number;
  holidayPay: number;
  bonuses: number;
  doublePay: number;
  grossPay: number;
  totalDeductions: number;
  cashAdvance: number;
  pendingCashAdvance: number;
  netPay: number;
  paid: boolean;
}

interface PayrollPrintSheetProps {
  periodName: string;
  payDate: string;
  scopeLabel: string;
  status: string;
  includeOvertimePay: boolean;
  showEmployeeName: boolean;
  showStatus: boolean;
  records: PayrollPrintRecord[];
}

/** Blank rather than ₱0.00 for the columns that are empty most of the time. */
function optional(amount: number) {
  return amount > 0 ? formatPeso(amount) : "—";
}

/**
 * The full computation on one sheet of letter paper, landscape so all the
 * columns fit and the figures stay big enough to read on paper.
 *
 * Mounted only while the user is printing (see PayrollTable), so the print
 * styles below never affect the rest of the app. It is portalled onto <body>
 * so the printed page can hide every other top-level node outright — hiding
 * is what keeps the rest of the dashboard from adding blank pages.
 */
export default function PayrollPrintSheet({
  periodName,
  payDate,
  scopeLabel,
  status,
  includeOvertimePay,
  showEmployeeName,
  showStatus,
  records,
}: PayrollPrintSheetProps) {
  const totals = records.reduce(
    (acc, r) => ({
      daysWorked: acc.daysWorked + r.daysWorked,
      basicPay: acc.basicPay + r.basicPay,
      overtimePay: acc.overtimePay + r.overtimePay,
      holidayPay: acc.holidayPay + r.holidayPay,
      bonuses: acc.bonuses + r.bonuses,
      doublePay: acc.doublePay + r.doublePay,
      grossPay: acc.grossPay + r.grossPay,
      totalDeductions: acc.totalDeductions + r.totalDeductions,
      cashAdvance: acc.cashAdvance + r.cashAdvance,
      netPay: acc.netPay + r.netPay,
    }),
    {
      daysWorked: 0,
      basicPay: 0,
      overtimePay: 0,
      holidayPay: 0,
      bonuses: 0,
      doublePay: 0,
      grossPay: 0,
      totalDeductions: 0,
      cashAdvance: 0,
      netPay: 0,
    }
  );

  const pendingTotal = records.reduce((sum, r) => sum + r.pendingCashAdvance, 0);

  const payDateLabel = new Date(payDate).toLocaleDateString("en-PH", {
    timeZone: PH_TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Printing is a client-side action, so the portal target is always there;
  // the guard is only for a render that happens without a document.
  if (typeof document === "undefined") return null;

  return (
    <>
      <style jsx global>{`
        .payroll-print-sheet {
          display: none;
        }
        @media print {
          @page {
            size: letter landscape;
            margin: 0.3in;
          }
          /* Only the sheet prints — gone rather than invisible, so the
             dashboard behind it cannot push the sheet onto later pages. */
          body > *:not(.payroll-print-sheet) {
            display: none !important;
          }
          .payroll-print-sheet {
            display: block;
          }
          .payroll-print-sheet thead {
            display: table-header-group;
          }
          .payroll-print-sheet tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {createPortal(
        <div className="payroll-print-sheet text-slate-900">
          <header className="text-center mb-[8pt]">
            <h1 className="text-[15pt] font-bold leading-tight">
              1MegaCore Construction Services
            </h1>
            <h2 className="text-[12pt] font-semibold mt-[2pt]">
              Payroll Computation
            </h2>
          </header>

          <div className="flex flex-wrap justify-between gap-x-[6pt] border-y border-slate-400 py-[4pt] text-[10pt]">
            <span>
              <span className="font-semibold">Period:</span> {periodName}
            </span>
            <span>
              <span className="font-semibold">Pay Date:</span> {payDateLabel}
            </span>
            <span>
              <span className="font-semibold">Coverage:</span> {scopeLabel}
            </span>
            <span>
              <span className="font-semibold">Status:</span> {status}
            </span>
          </div>

          {!includeOvertimePay && (
            <p className="text-[9.5pt] italic mt-[3pt]">
              Overtime pay was excluded when this payroll was computed.
            </p>
          )}

          <table className="w-full mt-[5pt] border border-slate-400 text-[10.5pt]">
            <thead>
              <tr className="bg-slate-100 text-[10.5pt]">
                {showEmployeeName && (
                  <th className="border border-slate-400 px-[3pt] py-[3pt] text-left">
                    Employee
                  </th>
                )}
                <th className="border border-slate-400 px-[3pt] py-[3pt] text-center">
                  Days
                </th>
                <th className="border border-slate-400 px-[3pt] py-[3pt] text-right">
                  Basic Pay
                </th>
                <th className="border border-slate-400 px-[3pt] py-[3pt] text-right">
                  OT Pay
                </th>
                <th className="border border-slate-400 px-[3pt] py-[3pt] text-right">
                  Holiday
                </th>
                <th className="border border-slate-400 px-[3pt] py-[3pt] text-right">
                  Bonus
                </th>
                <th className="border border-slate-400 px-[3pt] py-[3pt] text-right">
                  Double Pay
                </th>
                <th className="border border-slate-400 px-[3pt] py-[3pt] text-right">
                  Gross Pay
                </th>
                <th className="border border-slate-400 px-[3pt] py-[3pt] text-right">
                  Deductions
                </th>
                <th className="border border-slate-400 px-[3pt] py-[3pt] text-right">
                  Cash Advance
                </th>
                <th className="border border-slate-400 px-[3pt] py-[3pt] text-right">
                  Net Pay
                </th>
                {showStatus && (
                  <th className="border border-slate-400 px-[3pt] py-[3pt] text-center">
                    Status
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td
                    colSpan={10 + (showEmployeeName ? 1 : 0) + (showStatus ? 1 : 0)}
                    className="border border-slate-300 px-2 py-[6pt] text-center text-slate-500"
                  >
                    No payroll records for this period.
                  </td>
                </tr>
              ) : (
                records.map((r, i) => (
                  <tr key={i}>
                    {showEmployeeName && (
                      <td className="border border-slate-300 px-[3pt] py-[3pt]">
                        <span className="font-medium">{r.employeeName}</span>{" "}
                        <span className="text-[9pt] text-slate-500">
                          {r.employeeNumber}
                        </span>
                      </td>
                    )}
                    <td className="border border-slate-300 px-[3pt] py-[3pt] text-center font-medium">
                      {r.daysWorked}
                    </td>
                    <td className="border border-slate-300 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                      {formatPeso(r.basicPay)}
                    </td>
                    <td className="border border-slate-300 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                      {r.overtimePay > 0 ? (
                        formatPeso(r.overtimePay)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="border border-slate-300 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                      {r.holidayPay > 0 ? (
                        formatPeso(r.holidayPay)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="border border-slate-300 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                      {r.bonuses > 0 ? (
                        formatPeso(r.bonuses)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="border border-slate-300 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                      {r.doublePay > 0 ? (
                        formatPeso(r.doublePay)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="border border-slate-300 px-[3pt] py-[3pt] text-right font-semibold whitespace-nowrap">
                      {formatPeso(r.grossPay)}
                    </td>
                    <td className="border border-slate-300 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                      ({formatPeso(r.totalDeductions)})
                    </td>
                    <td className="border border-slate-300 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                      {r.cashAdvance > 0 ? (
                        `(${formatPeso(r.cashAdvance)})`
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {showEmployeeName && r.pendingCashAdvance > 0 && (
                        <span className="block text-[8.5pt] text-amber-700">
                          {formatPeso(r.pendingCashAdvance)} pending
                        </span>
                      )}
                    </td>
                    <td className="border border-slate-300 px-[3pt] py-[3pt] text-right font-bold whitespace-nowrap">
                      {formatPeso(r.netPay)}
                    </td>
                    {showStatus && (
                      <td className="border border-slate-300 px-[3pt] py-[3pt] text-center">
                        {r.paid ? "Paid" : "Pending"}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>

            {records.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  {showEmployeeName && (
                    <td className="border border-slate-400 px-[3pt] py-[3pt]">
                      TOTAL — {records.length} employee
                      {records.length !== 1 ? "s" : ""}
                    </td>
                  )}
                  <td className="border border-slate-400 px-[3pt] py-[3pt] text-center">
                    {totals.daysWorked}
                  </td>
                  <td className="border border-slate-400 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                    {formatPeso(totals.basicPay)}
                  </td>
                  <td className="border border-slate-400 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                    {optional(totals.overtimePay)}
                  </td>
                  <td className="border border-slate-400 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                    {optional(totals.holidayPay)}
                  </td>
                  <td className="border border-slate-400 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                    {optional(totals.bonuses)}
                  </td>
                  <td className="border border-slate-400 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                    {optional(totals.doublePay)}
                  </td>
                  <td className="border border-slate-400 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                    {formatPeso(totals.grossPay)}
                  </td>
                  <td className="border border-slate-400 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                    ({formatPeso(totals.totalDeductions)})
                  </td>
                  <td className="border border-slate-400 px-[3pt] py-[3pt] text-right whitespace-nowrap">
                    {totals.cashAdvance > 0
                      ? `(${formatPeso(totals.cashAdvance)})`
                      : "—"}
                  </td>
                  <td className="border border-slate-400 px-[3pt] py-[3pt] text-right text-[11.5pt] whitespace-nowrap">
                    {formatPeso(totals.netPay)}
                  </td>
                  {showStatus && (
                    <td className="border border-slate-400 px-[3pt] py-[3pt] text-center">
                      {records.filter((r) => r.paid).length}/{records.length}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>

          {showEmployeeName && pendingTotal > 0 && (
            <p className="text-[9.5pt] mt-[4pt]">
              Pending cash advances (outstanding, not deducted in this payroll):{" "}
              <span className="font-semibold">{formatPeso(pendingTotal)}</span>
            </p>
          )}

          <p className="text-[9pt] text-right mt-[6pt] text-slate-600">
            Printed {formatDateTime(new Date())}
          </p>
        </div>,
        document.body
      )}
    </>
  );
}
