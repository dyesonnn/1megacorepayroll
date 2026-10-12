import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import PayrollActions from "./PayrollActions";
import PayrollPeriodCard from "./PayrollPeriodCard";
import PayrollSummary, { type DepartmentTotals } from "./PayrollSummary";

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
      department: { select: { name: true } },
      _count: { select: { scopeEmployees: true } },
      records: {
        include: {
          // department is needed for the per-company totals below
          employee: { include: { department: { select: { id: true, name: true } } } },
          // Advances deducted through this record (shown in the CA column)
          cashAdvances: { where: { status: "DEDUCTED" }, select: { amount: true } },
        },
        orderBy: { employee: { employeeNumber: "asc" } },
      },
    },
  });

  // Outstanding cash advances per employee — pending, not yet deducted in any
  // payroll. Surfaced on the payroll page so HR is aware before adjusting.
  const pendingAdvanceGroups = await prisma.cashAdvance.groupBy({
    by: ["employeeId"],
    where: { status: "PENDING" },
    _sum: { amount: true },
  });
  const pendingAdvanceByEmployee = new Map(
    pendingAdvanceGroups.map((g) => [g.employeeId, g._sum.amount ?? 0])
  );

  const totalActiveEmployees = await prisma.employee.count({
    where: { employmentStatus: "ACTIVE" },
  });

  // Totals per department/company across every period. Each company is a
  // department (1MEGACORE, 1MPRL, Pauline's, ...), so this is what each entity
  // was actually paid. Records are few enough to total in memory.
  const totalsByDepartment = new Map<string, DepartmentTotals & { employeeIds: Set<string> }>();
  for (const period of periods) {
    for (const record of period.records) {
      const { id: departmentId, name: departmentName } = record.employee.department;
      const entry = totalsByDepartment.get(departmentId) ?? {
        departmentId,
        departmentName,
        employees: 0,
        gross: 0,
        deductions: 0,
        net: 0,
        cashAdvances: 0,
        paidCount: 0,
        recordCount: 0,
        employeeIds: new Set<string>(),
      };
      entry.employeeIds.add(record.employeeId);
      entry.gross += record.grossPay;
      entry.deductions += record.totalDeductions;
      entry.net += record.netPay;
      entry.cashAdvances += record.cashAdvances.reduce((sum, a) => sum + a.amount, 0);
      if (record.paid) entry.paidCount += 1;
      entry.recordCount += 1;
      totalsByDepartment.set(departmentId, entry);
    }
  }
  const departmentTotals: DepartmentTotals[] = [...totalsByDepartment.values()]
    .map(({ employeeIds, ...rest }) => ({ ...rest, employees: employeeIds.size }))
    .sort((a, b) => b.net - a.net);

  // Scope options for the create-period form: a department payroll needs the
  // department list, a hand-picked payroll needs the roster to choose from.
  const isEmployeeRole = session.role === "EMPLOYEE";
  const departments = isEmployeeRole
    ? []
    : await prisma.department.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { employees: { where: { employmentStatus: "ACTIVE" } } } } },
      });
  const roster = isEmployeeRole
    ? []
    : await prisma.employee.findMany({
        where: { employmentStatus: "ACTIVE" },
        orderBy: { employeeNumber: "asc" },
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
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
          <PayrollActions
            totalActiveEmployees={totalActiveEmployees}
            departments={departments.map((d) => ({
              id: d.id,
              name: d.name,
              activeEmployees: d._count.employees,
            }))}
            roster={roster.map((e) => ({
              id: e.id,
              employeeNumber: e.employeeNumber,
              firstName: e.firstName,
              lastName: e.lastName,
              departmentName: e.department.name,
            }))}
          />
        )}

        {/* Totals per department/company (Admin/HR — employees only see their own) */}
        {session.role !== "EMPLOYEE" && (
          <PayrollSummary rows={departmentTotals} periodCount={periods.length} />
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
                  scopeType: period.scopeType,
                  departmentName: period.department?.name ?? null,
                  scopeEmployeeCount: period._count.scopeEmployees,
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
                    cashAdvance: r.cashAdvances.reduce((sum, a) => sum + a.amount, 0),
                    pendingCashAdvance: pendingAdvanceByEmployee.get(r.employeeId) ?? 0,
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
