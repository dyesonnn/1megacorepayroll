import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import AttendanceSheet from "./AttendanceSheet";

export default async function AttendanceSheetPage({
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
  const monthParam = typeof params.month === "string" ? params.month : undefined;

  // Parse month or default to current
  let year: number;
  let month: number; // 0-indexed
  if (monthParam) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m - 1; // Convert to 0-indexed
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }

  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  // Get all active employees
  const employees = await prisma.employee.findMany({
    where: { employmentStatus: "ACTIVE" },
    orderBy: { employeeNumber: "asc" },
  });

  // Get attendance for this month
  const attendance = await prisma.attendance.findMany({
    where: {
      date: { gte: startOfMonth, lte: endOfMonth },
    },
    include: { projectSite: true },
    orderBy: [{ date: "asc" }, { timeIn: "asc" }],
  });

  // Build attendance map: employeeId -> date -> record
  const attendanceMap = new Map<string, Map<string, typeof attendance[0]>>();
  for (const record of attendance) {
    const dateKey = record.date.toISOString().split("T")[0];
    if (!attendanceMap.has(record.employeeId)) {
      attendanceMap.set(record.employeeId, new Map());
    }
    attendanceMap.get(record.employeeId)!.set(dateKey, record);
  }

  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Serialize employees for client component
  const serializedEmployees = employees.map((emp) => ({
    id: emp.id,
    employeeNumber: emp.employeeNumber,
    firstName: emp.firstName,
    lastName: emp.lastName,
  }));

  // Serialize attendance records
  const serializedAttendance: Record<string, Record<string, {
    timeIn: string | null;
    timeOut: string | null;
    hoursWorked: number;
    overtimeHours: number;
    lateMinutes: number;
    status: string;
    siteName: string;
  }>> = {};
  for (const [empId, dateMap] of attendanceMap) {
    serializedAttendance[empId] = {};
    for (const [dateKey, record] of dateMap) {
      serializedAttendance[empId][dateKey] = {
        timeIn: record.timeIn?.toISOString() || null,
        timeOut: record.timeOut?.toISOString() || null,
        hoursWorked: record.hoursWorked,
        overtimeHours: record.overtimeHours,
        lateMinutes: record.lateMinutes,
        status: record.status,
        siteName: record.projectSite?.name || "—",
      };
    }
  }

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Monthly Attendance Sheet</h1>
          <p className="text-slate-500 mt-1">
            View attendance for each employee by day
          </p>
        </div>
        <AttendanceSheet
          employees={serializedEmployees}
          attendance={serializedAttendance}
          year={year}
          month={month}
          daysInMonth={daysInMonth}
        />
      </div>
    </DashboardLayout>
  );
}
