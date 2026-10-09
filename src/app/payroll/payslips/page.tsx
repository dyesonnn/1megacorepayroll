import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { utcDayStart, dayKey } from "@/lib/utils";
import PayslipPrinter, { type PeriodOption } from "./PayslipPrinter";
import type { SlipData } from "./PayslipSlip";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Period dates are date-only values stored at UTC midnight, so format them in
// UTC — the shown day must not depend on the server's timezone.
function formatPeriodCovered(start: Date, end: Date): string {
  const startMonth = start.toLocaleString("en-PH", { month: "long", timeZone: "UTC" });
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    return `${startMonth} ${start.getUTCDate()}-${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  const endMonth = end.toLocaleString("en-PH", { month: "long", timeZone: "UTC" });
  return `${startMonth} ${start.getUTCDate()} - ${endMonth} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
}

interface PayslipsPageProps {
  searchParams: Promise<{ periodId?: string; employeeId?: string }>;
}

export default async function PayslipsPage({ searchParams }: PayslipsPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const isEmployee = session.role === "EMPLOYEE";
  const { periodId, employeeId } = await searchParams;

  // Periods the viewer can print. Employees only see periods they were paid in.
  const periodRows: PeriodOption[] = await prisma.payrollPeriod.findMany({
    where:
      isEmployee && session.employeeId
        ? { records: { some: { employeeId: session.employeeId } } }
        : undefined,
    orderBy: { startDate: "desc" },
    select: { id: true, name: true },
  });

  const selectedPeriodId =
    periodId && periodRows.some((p) => p.id === periodId)
      ? periodId
      : periodRows[0]?.id;

  if (!selectedPeriodId) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            No payroll periods yet
          </h1>
          <p className="text-sm text-slate-500 mb-4">
            Create and compute a payroll period before printing payslips.
          </p>
          <Link
            href="/payroll"
            className="inline-block px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ← Back to Payroll
          </Link>
        </div>
      </div>
    );
  }

  const period = await prisma.payrollPeriod.findUnique({
    where: { id: selectedPeriodId },
  });
  if (!period) redirect("/payroll");

  const records = await prisma.payrollRecord.findMany({
    where: {
      payrollPeriodId: period.id,
      ...(isEmployee && session.employeeId
        ? { employeeId: session.employeeId }
        : {}),
    },
    include: { employee: true, cashAdvances: true },
    orderBy: { employee: { employeeNumber: "asc" } },
  });

  // Attendance within the period (for Absent / Late "Less" rows). Period dates
  // are stored as UTC midnight of the calendar day, so the window is built
  // from their day keys — no server timezone involved.
  const startOfDay = utcDayStart(dayKey(period.startDate));
  const endOfDay = new Date(
    utcDayStart(dayKey(period.endDate)).getTime() + ONE_DAY_MS
  );

  const attendance = await prisma.attendance.findMany({
    where: { date: { gte: startOfDay, lt: endOfDay } },
    select: { employeeId: true, status: true, lateMinutes: true },
  });

  const attendanceByEmployee = new Map<string, { absent: number; late: number }>();
  for (const a of attendance) {
    const entry = attendanceByEmployee.get(a.employeeId) ?? {
      absent: 0,
      late: 0,
    };
    if (a.status === "ABSENT") entry.absent += 1;
    entry.late += a.lateMinutes || 0;
    attendanceByEmployee.set(a.employeeId, entry);
  }

  const slips: SlipData[] = records.map((r) => {
    const att = attendanceByEmployee.get(r.employeeId) ?? { absent: 0, late: 0 };
    const caTotal = r.cashAdvances.reduce((sum, a) => sum + a.amount, 0);
    return {
      recordId: r.id,
      employeeId: r.employeeId,
      employeeName: `${r.employee.lastName}, ${r.employee.firstName}`.toUpperCase(),
      position: r.employee.position,
      dailyRate: r.employee.dailyRate,
      daysWorked: r.daysWorked,
      basicPay: r.basicPay,
      overtimePay: r.overtimePay,
      holidayPay: r.holidayPay,
      allowances: r.allowances,
      bonuses: r.bonuses,
      doublePay: r.doublePay,
      grossPay: r.grossPay,
      sssDeduction: r.sssDeduction,
      philhealthDeduction: r.philhealthDeduction,
      pagibigDeduction: r.pagibigDeduction,
      withholdingTax: r.withholdingTax,
      otherDeductions: r.otherDeductions,
      caTotal,
      totalDeductions: r.totalDeductions,
      netPay: r.netPay,
      totalOvertimeHours: r.totalOvertimeHours,
      absentDeduction: att.absent * r.employee.dailyRate,
      lateDeduction: att.late * (r.employee.dailyRate / 480),
    };
  });

  return (
    <PayslipPrinter
      key={`${period.id}:${employeeId ?? "all"}`}
      periods={periodRows}
      period={{
        id: period.id,
        name: period.name,
        periodCovered: formatPeriodCovered(
          startOfDay,
          utcDayStart(dayKey(period.endDate))
        ),
        includeOvertimePay: period.includeOvertimePay,
        slips,
      }}
      canSelect={isEmployee ? false : true}
      preselectedEmployeeId={employeeId}
    />
  );
}
