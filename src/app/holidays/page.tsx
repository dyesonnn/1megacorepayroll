import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAuth as requireAuthFn } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import HolidayManager from "./HolidayManager";

export default async function HolidaysPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN" && session.role !== "HR") {
    redirect("/login");
  }

  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : session.email;

  const holidays = await prisma.holiday.findMany({
    orderBy: { date: "desc" },
  });

  const formattedHolidays = holidays.map((h) => ({
    id: h.id,
    name: h.name,
    date: h.date.toISOString(),
    type: h.type,
  }));

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Holiday Management</h1>
          <p className="text-slate-500 mt-1">Add and manage company holidays</p>
        </div>

        <HolidayManager holidays={formattedHolidays} />
      </div>
    </DashboardLayout>
  );
}
