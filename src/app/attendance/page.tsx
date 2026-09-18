import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import AttendanceTable from "./AttendanceTable";
import AttendanceForm from "./AttendanceForm";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : session.email;

  const params = await searchParams;
  const dateFilter = typeof params.date === "string" ? params.date : undefined;
  const monthFilter = typeof params.month === "string" ? params.month : undefined;

  // For employee, only show their attendance
  const where: Record<string, unknown> = {};
  if (session.role === "EMPLOYEE" && session.employeeId) {
    where.employeeId = session.employeeId;
  }

  if (dateFilter) {
    const date = new Date(dateFilter);
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    where.date = { gte: startOfDay, lt: endOfDay };
  } else if (monthFilter) {
    const [year, month] = monthFilter.split("-").map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);
    where.date = { gte: startOfMonth, lt: endOfMonth };
  } else {
    // Default: current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    where.date = { gte: startOfMonth, lt: endOfMonth };
  }

  const attendance = await prisma.attendance.findMany({
    where,
    include: { employee: true, projectSite: true },
    orderBy: [{ date: "desc" }, { timeIn: "asc" }],
  });

  const employees = session.role !== "EMPLOYEE"
    ? await prisma.employee.findMany({
        where: { employmentStatus: "ACTIVE" },
        orderBy: { employeeNumber: "asc" },
      })
    : [];

  const sites = await prisma.projectSite.findMany({ orderBy: { name: "asc" } });

  // Holiday types keyed by yyyy-mm-dd so the table can badge HOLIDAY rows
  const holidayRows = await prisma.holiday.findMany({ where });
  const holidaysByDate = new Map(
    holidayRows.map((h) => [h.date.toISOString().split("T")[0], h.type])
  );

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {session.role === "EMPLOYEE" ? "My Attendance" : "Attendance & Time Tracking"}
            </h1>
            <p className="text-slate-500 mt-1">Daily time-in/time-out records</p>
          </div>
          {session.role !== "EMPLOYEE" && (
            <a
              href="/attendance/sheet"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              📅 Monthly Sheet
            </a>
          )}
        </div>

        {/* Attendance Form (Admin/HR only) */}
        {session.role !== "EMPLOYEE" && (
          <AttendanceForm employees={employees} sites={sites} />
        )}

        {/* Attendance Table */}
        <AttendanceTable
          records={attendance.map((a) => ({
            id: a.id,
            employeeNumber: a.employee.employeeNumber,
            employeeName: `${a.employee.firstName} ${a.employee.lastName}`,
            date: a.date.toISOString(),
            timeIn: a.timeIn?.toISOString() || null,
            timeOut: a.timeOut?.toISOString() || null,
            hoursWorked: a.hoursWorked,
            overtimeHours: a.overtimeHours,
            lateMinutes: a.lateMinutes,
            undertimeMinutes: a.undertimeMinutes,
            status: a.status,
            holidayType: holidaysByDate.get(a.date.toISOString().split("T")[0]) ?? null,
            siteName: a.projectSite?.name || "—",
          }))}
          showEmployeeName={session.role !== "EMPLOYEE"}
          userRole={session.role}
        />
      </div>
    </DashboardLayout>
  );
}
