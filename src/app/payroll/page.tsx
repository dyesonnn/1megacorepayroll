import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import PayrollActions from "./PayrollActions";
import PayrollPeriodCard from "./PayrollPeriodCard";

export default async function PayrollPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : session.email;

  // For employee, only show their payroll records
  const where: Record<string, unknown> = {};
  if (session.role === "EMPLOYEE" && session.employeeId) {
    where.employeeId = session.employeeId;
  }

  const periods = await prisma.payrollPeriod.findMany({
    orderBy: { startDate: "desc" },
    include: {
      records: {
        include: { employee: true },
        orderBy: { employee: { employeeNumber: "asc" } },
      },
    },
  });

  const totalActiveEmployees = await prisma.employee.count({
    where: { employmentStatus: "ACTIVE" },
  });

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {session.role === "EMPLOYEE" ? "My Payslips" : "Payroll Management"}
            </h1>
            <p className="text-slate-500 mt-1">Payroll periods and payslip generation</p>
          </div>
        </div>

        {/* Payroll Actions (Admin/HR) */}
        {session.role !== "EMPLOYEE" && (
          <PayrollActions totalActiveEmployees={totalActiveEmployees} />
        )}

        {/* Payroll Periods */}
        <div className="space-y-4">
          {periods.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-slate-500">No payroll periods created yet.</p>
            </div>
          ) : (
            periods.map((period, i) => (
              <PayrollPeriodCard
                key={period.id}
                period={{
                  id: period.id,
                  name: period.name,
                  payDate: period.payDate.toISOString(),
                  status: period.status,
                  includeOvertimePay: period.includeOvertimePay,
                  records: period.records.map((r) => ({
                    id: r.id,
                    employeeId: r.employeeId,
                    employeeNumber: r.employee.employeeNumber,
                    employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
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
                    totalDeductions: r.totalDeductions,
                    netPay: r.netPay,
                    daysWorked: r.daysWorked,
                    paid: r.paid,
                  })),
                }}
                showControls={session.role !== "EMPLOYEE"}
                defaultExpanded={period.status !== "PAID"}
              />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
