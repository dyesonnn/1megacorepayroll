"use client";

import { useState } from "react";
import { formatPeso } from "@/lib/utils";
import PayrollTable from "./PayrollTable";
import ComputePayrollButton from "./ComputePayrollButton";
import DeletePeriodButton from "./DeletePeriodButton";

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
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

interface PayrollPeriodCardProps {
  period: {
    id: string;
    name: string;
    payDate: string;
    status: string;
    includeOvertimePay: boolean;
    records: PayrollRecord[];
  };
  showControls: boolean;
  defaultExpanded?: boolean;
}

export default function PayrollPeriodCard({ period, showControls, defaultExpanded = false }: PayrollPeriodCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const totalNetPay = period.records.reduce((sum, r) => sum + r.netPay, 0);
  const paidCount = period.records.filter((r) => r.paid).length;
  const totalCount = period.records.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header — always visible, clickable to toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span
            className={`text-slate-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{period.name}</h2>
              {!period.includeOvertimePay && (
                <span
                  className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700"
                  title="This payroll period was computed without overtime pay"
                >
                  OT Excluded
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Pay Date: {new Date(period.payDate).toLocaleDateString("en-PH")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick summary when collapsed */}
          {!expanded && (
            <>
              <span className="text-sm font-medium text-slate-600">
                {totalCount} employee{totalCount !== 1 ? "s" : ""}
              </span>
              <span className="text-sm font-semibold text-blue-600">
                {formatPeso(totalNetPay)}
              </span>
              <span className="text-xs text-slate-500">
                {paidCount}/{totalCount} paid
              </span>
            </>
          )}

          <span
            className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
              period.status === "PAID"
                ? "bg-green-100 text-green-700"
                : period.status === "COMPLETED"
                  ? "bg-blue-100 text-blue-700"
                  : period.status === "PROCESSING"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-slate-100 text-slate-600"
            }`}
          >
            {period.status}
          </span>

          {showControls && (
            <div className="ml-1 flex items-start gap-2" onClick={(e) => e.stopPropagation()}>
              <ComputePayrollButton periodId={period.id} periodStatus={period.status} />
              <DeletePeriodButton periodId={period.id} periodName={period.name} />
            </div>
          )}
        </div>
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <PayrollTable
            records={period.records}
            showEmployeeName={showControls}
            periodId={period.id}
            periodStatus={period.status}
            otExcluded={!period.includeOvertimePay}
          />
        </div>
      )}
    </div>
  );
}
