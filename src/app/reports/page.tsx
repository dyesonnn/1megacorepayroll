import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import { formatPeso } from "@/lib/utils";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session || session.role === "EMPLOYEE") redirect("/login");

  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : session.email;

  // Stats
  const totalEmployees = await prisma.employee.count({ where: { employmentStatus: "ACTIVE" } });
  const totalSites = await prisma.projectSite.count({ where: { isActive: true } });

  // Payroll summary
  const payrollPeriods = await prisma.payrollPeriod.findMany({
    orderBy: { startDate: "desc" },
    take: 5,
    include: { records: true },
  });

  const totalPayroll = payrollPeriods.reduce(
    (sum, p) => sum + p.records.reduce((rSum, r) => rSum + r.netPay, 0),
    0
  );
  const totalDeductions = payrollPeriods.reduce(
    (sum, p) => sum + p.records.reduce((rSum, r) => rSum + r.totalDeductions, 0),
    0
  );

  // Attendance summary (current month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const monthlyAttendance = await prisma.attendance.groupBy({
    by: ["status"],
    where: {
      date: { gte: monthStart, lt: monthEnd },
    },
    _count: true,
  });

  // Labor cost by site
  const siteLaborCosts = await prisma.attendance.groupBy({
    by: ["projectSiteId"],
    where: {
      date: { gte: monthStart, lt: monthEnd },
      hoursWorked: { gt: 0 },
    },
    _sum: { hoursWorked: true },
  });

  const sites = await prisma.projectSite.findMany();
  const siteMap = new Map(sites.map((s) => [s.id, s.name]));

  // Employee by department
  const deptCounts = await prisma.employee.groupBy({
    by: ["departmentId"],
    where: { employmentStatus: "ACTIVE" },
    _count: true,
  });

  const departments = await prisma.department.findMany();
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-500 mt-1">System-wide overview and reports</p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Active Employees</p>
            <p className="text-2xl font-bold text-slate-900">{totalEmployees}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Active Project Sites</p>
            <p className="text-2xl font-bold text-slate-900">{totalSites}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Total Payroll (Last 5 Periods)</p>
            <p className="text-2xl font-bold text-blue-600">{formatPeso(totalPayroll)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Total Deductions</p>
            <p className="text-2xl font-bold text-red-600">{formatPeso(totalDeductions)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payroll Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Payroll Summary</h2>
            {payrollPeriods.length === 0 ? (
              <p className="text-slate-500 text-sm">No payroll data available.</p>
            ) : (
              <div className="space-y-3">
                {payrollPeriods.map((period) => {
                  const totalGross = period.records.reduce((s, r) => s + r.grossPay, 0);
                  const totalNet = period.records.reduce((s, r) => s + r.netPay, 0);
                  const totalDed = period.records.reduce((s, r) => s + r.totalDeductions, 0);
                  return (
                    <div key={period.id} className="py-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-slate-700">{period.name}</p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          period.status === "PAID" ? "bg-green-100 text-green-700" :
                          period.status === "COMPLETED" ? "bg-blue-100 text-blue-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {period.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-500">Gross</p>
                          <p className="font-medium">{formatPeso(totalGross)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Deductions</p>
                          <p className="font-medium text-red-600">{formatPeso(totalDed)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Net</p>
                          <p className="font-bold text-blue-600">{formatPeso(totalNet)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Attendance Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Monthly Attendance</h2>
            <div className="space-y-3">
              {monthlyAttendance.map((a) => (
                <div key={a.status} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${
                      a.status === "PRESENT" ? "bg-green-500" :
                      a.status === "LATE" ? "bg-yellow-500" :
                      a.status === "ABSENT" ? "bg-red-500" :
                      a.status === "UNDERTIME" ? "bg-orange-500" :
                      "bg-slate-400"
                    }`} />
                    <span className="text-sm font-medium text-slate-700">{a.status}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{a._count}</span>
                </div>
              ))}
              {monthlyAttendance.length === 0 && (
                <p className="text-slate-500 text-sm">No attendance data for this month.</p>
              )}
            </div>
          </div>

          {/* Labor Cost by Site */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Hours by Project Site</h2>
            <div className="space-y-3">
              {siteLaborCosts.map((slc) => (
                <div key={slc.projectSiteId || "none"} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm font-medium text-slate-700">
                    {slc.projectSiteId ? siteMap.get(slc.projectSiteId) || "Unknown" : "Unassigned"}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {(slc._sum.hoursWorked || 0).toFixed(1)}h
                  </span>
                </div>
              ))}
              {siteLaborCosts.length === 0 && (
                <p className="text-slate-500 text-sm">No data available.</p>
              )}
            </div>
          </div>

          {/* Department Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Employees by Department</h2>
            <div className="space-y-3">
              {deptCounts.map((dc) => (
                <div key={dc.departmentId} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm font-medium text-slate-700">
                    {deptMap.get(dc.departmentId) || "Unknown"}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(dc._count / totalEmployees) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 w-8 text-right">{dc._count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
