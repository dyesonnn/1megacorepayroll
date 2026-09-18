import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import { formatPeso, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;

  const userName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : session.email;

  // Common stats
  const totalEmployees = await prisma.employee.count({ where: { employmentStatus: "ACTIVE" } });
  const activeSites = await prisma.projectSite.count({ where: { isActive: true } });

  // Current payroll period
  const currentPeriod = await prisma.payrollPeriod.findFirst({
    orderBy: { startDate: "desc" },
  });

  // Recent attendance for employee view
  const recentAttendance = session.employeeId
    ? await prisma.attendance.findMany({
        where: { employeeId: session.employeeId },
        orderBy: { date: "desc" },
        take: 5,
        include: { projectSite: true },
      })
    : [];

  // Admin/HR view: recent payroll records
  const recentPayrolls = session.role !== "EMPLOYEE"
    ? await prisma.payrollRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { employee: true, payrollPeriod: true },
      })
    : [];

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            {session.role === "EMPLOYEE" ? "My Dashboard" : "Admin Dashboard"}
          </h1>
          <p className="text-slate-500 mt-1">
            {session.role === "EMPLOYEE"
              ? "Welcome back! Here&apos;s your overview."
              : "Welcome to 1MegaCore HR & Payroll System"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Active Employees"
            value={totalEmployees}
            icon="👥"
            color="blue"
          />
          <StatCard
            title="Project Sites"
            value={activeSites}
            icon="🏗️"
            color="green"
          />
          <StatCard
            title="Current Pay Period"
            value={currentPeriod?.name || "No period"}
            icon="💰"
            color="yellow"
          />
          <StatCard
            title="Pay Period Status"
            value={currentPeriod?.status || "N/A"}
            icon="📋"
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Employee: My Attendance */}
          {session.role === "EMPLOYEE" && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Attendance</h2>
              <div className="space-y-3">
                {recentAttendance.length === 0 ? (
                  <p className="text-slate-500 text-sm">No attendance records yet.</p>
                ) : (
                  recentAttendance.map((att) => (
                    <div key={att.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{formatDate(att.date)}</p>
                        <p className="text-xs text-slate-500">{att.projectSite?.name || "N/A"}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          att.status === "PRESENT" ? "bg-green-100 text-green-700" :
                          att.status === "LATE" ? "bg-yellow-100 text-yellow-700" :
                          att.status === "ABSENT" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {att.status}
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {att.hoursWorked.toFixed(1)}h {att.overtimeHours > 0 ? `(+${att.overtimeHours.toFixed(1)} OT)` : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Admin/HR: Recent Payroll */}
          {session.role !== "EMPLOYEE" && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Payroll</h2>
              <div className="space-y-3">
                {recentPayrolls.length === 0 ? (
                  <p className="text-slate-500 text-sm">No payroll records yet.</p>
                ) : (
                  recentPayrolls.map((pr) => (
                    <div key={pr.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {pr.employee.firstName} {pr.employee.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{pr.payrollPeriod.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{formatPeso(pr.netPay)}</p>
                        <p className={`text-xs font-medium ${
                          pr.payrollPeriod.status === "PAID" ? "text-green-600" : "text-yellow-600"
                        }`}>
                          {pr.payrollPeriod.status}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Admin-only: Quick Actions */}
        {session.role === "ADMIN" && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <a href="/employees/new" className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition">
                <span className="text-2xl">➕</span>
                <span className="text-sm font-medium text-slate-700">Add Employee</span>
              </a>
              <a href="/attendance" className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-green-300 hover:bg-green-50 transition">
                <span className="text-2xl">📋</span>
                <span className="text-sm font-medium text-slate-700">Log Attendance</span>
              </a>
              <a href="/payroll" className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-yellow-300 hover:bg-yellow-50 transition">
                <span className="text-2xl">💵</span>
                <span className="text-sm font-medium text-slate-700">Run Payroll</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
