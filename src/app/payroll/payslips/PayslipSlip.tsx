"use client";

import PayslipLogo from "./PayslipLogo";

/** Everything one payslip needs, precomputed on the server. */
export interface SlipData {
  recordId: string;
  employeeId: string;
  employeeName: string;
  position: string;
  dailyRate: number;
  daysWorked: number;
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
  caTotal: number;
  totalDeductions: number;
  netPay: number;
  totalOvertimeHours: number;
  absentDeduction: number;
  lateDeduction: number;
}

// Matches the format used by the previous single payslip page.
function peso(amount: number): string {
  return `PHP ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Row({
  label,
  note,
  value,
}: {
  label: string;
  note?: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline py-[1px]">
      <span className="min-w-0 truncate">
        {label}
        {note ? <em> ({note})</em> : null}
      </span>
      <span className="ml-auto pl-2 font-bold whitespace-nowrap">{value}</span>
    </div>
  );
}

export default function PayslipSlip({
  slip,
  periodCovered,
  periodName,
  otExcluded,
}: {
  slip: SlipData;
  periodCovered: string;
  periodName: string;
  otExcluded: boolean;
}) {
  return (
    <div
      className="payslip-slip flex flex-col border border-black bg-white text-black overflow-hidden"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {/* Header: logo + title + period */}
      <div className="flex items-center gap-3 px-3 pt-2 pb-1">
        <PayslipLogo />
        <h1 className="text-lg font-bold tracking-wide">PAYSLIP</h1>
        <span className="ml-auto text-[10px] italic">{periodName}</span>
      </div>

      {/* Employee info */}
      <div className="flex px-3 pb-1 text-[10px]">
        <div className="flex-1 space-y-0.5">
          <div className="flex">
            <span className="italic w-32 flex-none">EMPLOYEE NAME:</span>
            <span className="font-bold">{slip.employeeName}</span>
          </div>
          <div className="flex">
            <span className="italic w-32 flex-none">POSITION:</span>
            <span className="font-bold">{slip.position}</span>
          </div>
        </div>
        <div className="w-[42%]">
          <div className="flex">
            <span className="italic w-28 flex-none">PERIOD COVERED:</span>
            <span className="font-bold">{periodCovered}</span>
          </div>
        </div>
      </div>

      {/* Earnings / Deductions */}
      <div className="flex flex-1 border-t border-b border-black text-[10px]">
        {/* EARNINGS */}
        <div className="w-1/2 border-r border-black flex flex-col">
          <div className="bg-gray-300 text-center font-bold py-0.5 text-[11px]">
            EARNINGS
          </div>
          <div className="flex-1 flex flex-col px-3 py-1 leading-none">
            <Row label="Basic Rate:" value={peso(slip.dailyRate)} />
            <Row label="Days Worked:" value={String(slip.daysWorked)} />
            <Row label="Basic Pay:" value={peso(slip.basicPay)} />
            <div className="h-1" />
            <Row label="OT Hours:" value={slip.totalOvertimeHours.toFixed(2)} />
            <Row
              label="OT Pay:"
              value={otExcluded ? "Excluded" : peso(slip.overtimePay)}
            />
            <Row label="Holiday Pay:" value={peso(slip.holidayPay)} />
            <Row label="ND Pay:" value={peso(0)} />
            {slip.allowances > 0 && (
              <Row label="Allowance:" value={peso(slip.allowances)} />
            )}
            {slip.bonuses > 0 && (
              <Row label="Bonus:" value={peso(slip.bonuses)} />
            )}
            {slip.doublePay > 0 && (
              <Row label="Double Pay:" value={peso(slip.doublePay)} />
            )}
            <div className="h-1" />
            <Row label="Absent" note="Less" value={peso(slip.absentDeduction)} />
            <Row label="Late" note="Less" value={peso(slip.lateDeduction)} />
            <div className="mt-auto flex items-baseline pt-1">
              <span className="font-bold italic text-[11px]">GROSS PAY:</span>
              <span className="ml-auto font-bold text-[11px]">
                {peso(slip.grossPay)}
              </span>
            </div>
          </div>
        </div>

        {/* DEDUCTIONS */}
        <div className="w-1/2 flex flex-col">
          <div className="bg-gray-300 text-center font-bold py-0.5 text-[11px]">
            DEDUCTIONS
          </div>
          <div className="flex-1 flex flex-col px-3 py-1 leading-none">
            <Row label="SSS:" value={peso(slip.sssDeduction)} />
            <Row label="Philhealth:" value={peso(slip.philhealthDeduction)} />
            <Row label="HDMF" value={peso(slip.pagibigDeduction)} />
            <Row label="Loan:" value={peso(0)} />
            <Row label="W/Holding Tax" value={peso(slip.withholdingTax)} />
            <Row label="Other Deduction:" value={peso(slip.otherDeductions)} />
            <Row label="CA" value={peso(slip.caTotal)} />
            <div className="mt-auto flex items-baseline pt-1">
              <span className="font-bold italic text-[11px]">
                TOTAL DEDUCTION:
              </span>
              <span className="ml-auto font-bold text-[11px]">
                {peso(slip.totalDeductions)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* NET PAY band */}
      <div className="flex bg-gray-300 text-[11px]">
        <div className="w-1/2 border-r border-black py-1 text-center italic font-bold">
          NET PAY
        </div>
        <div className="w-1/2 py-1 text-center font-bold">
          {peso(slip.netPay)}
        </div>
      </div>
    </div>
  );
}
