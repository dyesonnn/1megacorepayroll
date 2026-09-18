import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PayslipViewer from "./PayslipViewer";
import PayslipLogo from "./PayslipLogo";

function peso(amount: number): string {
  return `PHP ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPeriodCovered(start: Date, end: Date): string {
  const startMonth = start.toLocaleString("en-PH", { month: "long" });
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
  }
  const endMonth = end.toLocaleString("en-PH", { month: "long" });
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

function PayRow({
  label,
  note,
  value,
}: {
  label: string;
  note?: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline py-[3px]">
      <span className="w-44 flex-none">
        {label}
        {note ? <em className="text-xs"> ({note})</em> : null}
      </span>
      <span className="ml-auto font-bold">{value}</span>
    </div>
  );
}

function Spacer() {
  return <div className="h-3" />;
}

interface PayslipPageProps {
  params: Promise<{ recordId: string }>;
}

export default async function PayslipPage({ params }: PayslipPageProps) {
  const { recordId } = await params;

  const session = await getSession();
  if (!session) redirect("/login");

  const record = await prisma.payrollRecord.findUnique({
    where: { id: recordId },
    include: { employee: true, payrollPeriod: true },
  });
  if (!record) notFound();

  // Employees can only view their own payslip
  if (session.role === "EMPLOYEE" && record.employeeId !== session.employeeId) {
    redirect("/payroll");
  }

  const { employee, payrollPeriod: period } = record;

  // Cash advances (CA) linked to this payroll record
  const advances = await prisma.cashAdvance.findMany({
    where: { payrollRecordId: record.id },
  });
  const caTotal = advances.reduce((sum, a) => sum + a.amount, 0);

  // Attendance within the period (for Absent / Late info rows)
  const start = new Date(period.startDate);
  const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = new Date(period.endDate);
  const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);

  const attendance = await prisma.attendance.findMany({
    where: {
      employeeId: record.employeeId,
      date: { gte: startOfDay, lt: endOfDay },
    },
  });
  const absentDays = attendance.filter((a) => a.status === "ABSENT").length;
  const lateMinutes = attendance.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);
  const absentDeduction = absentDays * employee.dailyRate;
  const lateDeduction = lateMinutes * (employee.dailyRate / 480);

  const employeeName = `${employee.lastName}, ${employee.firstName}`.toUpperCase();
  const periodCovered = formatPeriodCovered(startOfDay, new Date(end.getFullYear(), end.getMonth(), end.getDate()));
  const overtimeHours = record.totalOvertimeHours.toFixed(2);
  // OT pay may be excluded for this period (e.g. lack of funds)
  const otExcluded = period.includeOvertimePay === false;

  return (
    <PayslipViewer periodName={period.name} employeeName={employeeName}>
        <div
          className="payslip-sheet mx-auto max-w-[1000px] bg-white border border-black text-black"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          {/* Header: logo + title */}
          <div className="flex items-center gap-6 px-6 pt-5 pb-3">
            <PayslipLogo />
            <h1 className="text-4xl font-bold tracking-wide">PAYSLIP</h1>
          </div>

          {/* Employee info */}
          <div className="flex px-6 pb-4 text-sm">
            <div className="flex-1 space-y-1">
              <div className="flex">
                <span className="italic w-48 flex-none">EMPLOYEE NAME:</span>
                <span className="font-bold">{employeeName}</span>
              </div>
              <div className="flex">
                <span className="italic w-48 flex-none">POSITION:</span>
                <span className="font-bold">{employee.position}</span>
              </div>
            </div>
            <div className="w-[38%]">
              <div className="flex">
                <span className="italic w-44 flex-none">PERIOD COVERED:</span>
                <span className="font-bold">{periodCovered}</span>
              </div>
            </div>
          </div>

          {/* Earnings / Deductions columns */}
          <div className="flex border-t border-b border-black text-sm">
            {/* EARNINGS */}
            <div className="w-1/2 border-r border-black">
              <div className="bg-gray-300 text-center font-bold py-1 text-base">
                EARNINGS
              </div>
              <div className="px-5 py-3 flex flex-col min-h-[300px]">
                <PayRow label="Basic Rate:" value={peso(employee.dailyRate)} />
                <PayRow label="Days Worked:" value={String(record.daysWorked)} />
                <Spacer />
                <PayRow label="OT Hours:" value={overtimeHours} />
                <PayRow
                  label="OT Pay:"
                  value={otExcluded ? "Excluded" : peso(record.overtimePay)}
                />
                <PayRow label="Holiday Pay:" value={peso(record.holidayPay)} />
                <PayRow label="ND Pay:" value={peso(0)} />
                {record.allowances > 0 && (
                  <PayRow label="Allowance:" value={peso(record.allowances)} />
                )}
                {record.bonuses > 0 && (
                  <PayRow label="Bonus:" value={peso(record.bonuses)} />
                )}
                {record.doublePay > 0 && (
                  <PayRow label="Double Pay:" value={peso(record.doublePay)} />
                )}
                <Spacer />
                <PayRow
                  label="Absent"
                  note="Less"
                  value={peso(absentDeduction)}
                />
                <PayRow label="Late" note="Less" value={peso(lateDeduction)} />
                <div className="mt-auto flex items-baseline pt-3">
                  <span className="w-44 flex-none font-bold italic text-base">
                    GROSS PAY:
                  </span>
                  <span className="ml-auto font-bold text-base">
                    {peso(record.grossPay)}
                  </span>
                </div>
              </div>
            </div>

            {/* DEDUCTIONS */}
            <div className="w-1/2">
              <div className="bg-gray-300 text-center font-bold py-1 text-base">
                DEDUCTIONS
              </div>
              <div className="px-5 py-3 flex flex-col min-h-[300px]">
                <PayRow label="SSS:" value={peso(record.sssDeduction)} />
                <PayRow label="Philhealth:" value={peso(record.philhealthDeduction)} />
                <PayRow label="HDMF" value={peso(record.pagibigDeduction)} />
                <PayRow label="Loan:" value={peso(0)} />
                <PayRow label="W/Holding Tax" value={peso(record.withholdingTax)} />
                <PayRow label="Other Deduction:" value={peso(record.otherDeductions)} />
                <PayRow label="CA" value={peso(caTotal)} />
                <div className="mt-auto flex items-baseline pt-3">
                  <span className="w-44 flex-none font-bold italic text-base">
                    TOTAL DEDUCTION:
                  </span>
                  <span className="ml-auto font-bold text-base">
                    {peso(record.totalDeductions)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* NET PAY band */}
          <div className="flex border-t border-black text-base bg-gray-300">
            <div className="w-1/2 border-r border-black py-2 text-center italic font-bold">
              NET PAY
            </div>
            <div className="w-1/2 py-2 text-center font-bold">{peso(record.netPay)}</div>
          </div>
        </div>
    </PayslipViewer>
  );
}
