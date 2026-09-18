"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/utils";
import DataTable, { type Column } from "@/components/DataTable";
import AdjustmentModal from "./AdjustmentModal";

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

interface PayrollTableProps {
  records: PayrollRecord[];
  showEmployeeName: boolean;
  periodId: string;
  periodStatus: string;
  otExcluded?: boolean;
}

export default function PayrollTable({ records, showEmployeeName, periodId, periodStatus, otExcluded = false }: PayrollTableProps) {
  const router = useRouter();
  const [adjustingRecord, setAdjustingRecord] = useState<PayrollRecord | null>(null);
  const [localRecords, setLocalRecords] = useState(records);
  const [payingRecordId, setPayingRecordId] = useState<string | null>(null);

  // Sync local records when server-side records change (e.g. after Compute Payroll)
  useEffect(() => {
    setLocalRecords(records);
  }, [records]);

  const handleAdjust = (record: PayrollRecord) => {
    setAdjustingRecord(record);
  };

  const handleSaveAdjustment = (updatedRecord: PayrollRecord) => {
    setLocalRecords((prev) =>
      prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
    );
    setAdjustingRecord(null);
  };

  const handleMarkAsPaid = async (recordId: string) => {
    setPayingRecordId(recordId);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "markPaid", recordId, periodId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to mark as paid");
        return;
      }

      const result = await res.json();
      // Update the record's paid status
      setLocalRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, paid: true } : r))
      );

      // If all employees are paid, refresh to show updated period status
      if (result.allPaid) {
        window.location.reload();
      }
    } catch {
      alert("Connection error. Please try again.");
    } finally {
      setPayingRecordId(null);
    }
  };

  const columns: Column[] = [
    ...(showEmployeeName
      ? [
          {
            key: "employeeName",
            label: "Employee",
            sortable: true,
            render: (item: PayrollRecord) => (
              <div>
                <p className="font-medium text-slate-900">{item.employeeName}</p>
                <p className="text-xs text-slate-500">{item.employeeNumber}</p>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "daysWorked",
      label: "Days",
      sortable: true,
      render: (item: PayrollRecord) => <span className="font-medium">{item.daysWorked}</span>,
    },
    {
      key: "basicPay",
      label: "Basic Pay",
      sortable: true,
      render: (item: PayrollRecord) => formatPeso(item.basicPay),
    },
    {
      key: "overtimePay",
      label: "OT Pay",
      sortable: true,
      render: (item: PayrollRecord) =>
        item.overtimePay > 0 ? (
          <span className="text-green-600">{formatPeso(item.overtimePay)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "holidayPay",
      label: "Holiday",
      sortable: true,
      render: (item: PayrollRecord) =>
        item.holidayPay > 0 ? (
          <span className="text-green-600">{formatPeso(item.holidayPay)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "bonuses",
      label: "Bonus",
      sortable: true,
      render: (item: PayrollRecord) =>
        item.bonuses > 0 ? (
          <span className="text-green-600">{formatPeso(item.bonuses)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "doublePay",
      label: "Double Pay",
      sortable: true,
      render: (item: PayrollRecord) =>
        item.doublePay > 0 ? (
          <span className="text-green-600">{formatPeso(item.doublePay)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "grossPay",
      label: "Gross Pay",
      sortable: true,
      render: (item: PayrollRecord) => <span className="font-semibold">{formatPeso(item.grossPay)}</span>,
    },
    {
      key: "totalDeductions",
      label: "Deductions",
      sortable: true,
      render: (item: PayrollRecord) => <span className="text-red-600">({formatPeso(item.totalDeductions)})</span>,
    },
    {
      key: "netPay",
      label: "Net Pay",
      sortable: true,
      render: (item: PayrollRecord) => (
        <span className="font-bold text-slate-900 text-base">{formatPeso(item.netPay)}</span>
      ),
    },
    {
      key: "payslip",
      label: "Payslip",
      render: (item: PayrollRecord) => (
        <button
          onClick={() => router.push(`/payroll/payslip/${item.id}`)}
          className="px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="View print-ready payslip"
        >
          🧾 Payslip
        </button>
      ),
    },
    // Add Paid Status column
    ...(periodStatus !== "PAID"
      ? [
          {
            key: "paidStatus",
            label: "Status",
            render: (item: PayrollRecord) => (
              item.paid ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                  ✅ Paid
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                  ⏳ Pending
                </span>
              )
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (item: PayrollRecord) => (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAdjust(item)}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Adjust deductions and bonuses"
                >
                  ✏️ Adjust
                </button>
                {!item.paid && (
                  <button
                    onClick={() => handleMarkAsPaid(item.id)}
                    disabled={payingRecordId === item.id}
                    className="px-3 py-1 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Mark as paid"
                  >
                    {payingRecordId === item.id ? "Paying..." : "💰 Paid"}
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  // Calculate totals
  const totals = localRecords.reduce(
    (acc, r) => ({
      basicPay: acc.basicPay + r.basicPay,
      overtimePay: acc.overtimePay + r.overtimePay,
      holidayPay: acc.holidayPay + r.holidayPay,
      bonuses: acc.bonuses + r.bonuses,
      doublePay: acc.doublePay + r.doublePay,
      grossPay: acc.grossPay + r.grossPay,
      otherDeductions: acc.otherDeductions + r.otherDeductions,
      totalDeductions: acc.totalDeductions + r.totalDeductions,
      netPay: acc.netPay + r.netPay,
    }),
    { basicPay: 0, overtimePay: 0, holidayPay: 0, bonuses: 0, doublePay: 0, grossPay: 0, otherDeductions: 0, totalDeductions: 0, netPay: 0 }
  );

  return (
    <div>
      <DataTable
        columns={columns}
        data={localRecords as unknown as Record<string, unknown>[]}
        pageSize={15}
      />

      {/* Summary */}
      <div className="mt-4 flex justify-end">
        <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm min-w-[300px]">
          <div className="flex justify-between">
            <span className="text-slate-600">Total Basic Pay:</span>
            <span className="font-medium">{formatPeso(totals.basicPay)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              Total Overtime Pay:{" "}
              {otExcluded && <em className="text-orange-600 not-italic">(excluded)</em>}
            </span>
            <span className={`font-medium ${otExcluded ? "text-slate-400 line-through" : "text-green-600"}`}>
              {formatPeso(totals.overtimePay)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total Bonuses:</span>
            <span className="font-medium text-green-600">{formatPeso(totals.bonuses)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total Double Pay:</span>
            <span className="font-medium text-green-600">{formatPeso(totals.doublePay)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-600">Total Gross Pay:</span>
            <span className="font-semibold">{formatPeso(totals.grossPay)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total Other Deductions:</span>
            <span className="font-medium text-red-600">({formatPeso(totals.otherDeductions)})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total Deductions:</span>
            <span className="font-medium text-red-600">({formatPeso(totals.totalDeductions)})</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-900">Total Net Pay:</span>
            <span className="font-bold text-lg text-blue-600">{formatPeso(totals.netPay)}</span>
          </div>
        </div>
      </div>

      {/* Adjustment Modal */}
      {adjustingRecord && (
        <AdjustmentModal
          record={adjustingRecord}
          onClose={() => setAdjustingRecord(null)}
          onSave={handleSaveAdjustment}
        />
      )}
    </div>
  );
}
