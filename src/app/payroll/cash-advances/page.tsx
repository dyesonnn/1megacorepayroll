import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import CashAdvanceManager from "./CashAdvanceManager";
import { getSettings } from "@/lib/settings";

export default async function CashAdvancesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : session.email;

  const employees = await prisma.employee.findMany({
    where: { employmentStatus: "ACTIVE" },
    orderBy: { employeeNumber: "asc" },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      dailyRate: true,
    },
  });

  const advances = await prisma.cashAdvance.findMany({
    include: {
      employee: {
        select: { employeeNumber: true, firstName: true, lastName: true },
      },
    },
    orderBy: { advanceDate: "desc" },
  });

  const settings = await getSettings();

  const serializedAdvances = advances.map((a) => ({
    ...a,
    advanceDate: a.advanceDate.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cash Advances</h1>
            <p className="text-slate-500 mt-1">Track and manage employee cash advances by date</p>
          </div>
          <a
            href="/payroll/cash-advances/sheet"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            📅 Monthly Sheet
          </a>
        </div>
        <CashAdvanceManager
          employees={employees}
          initialAdvances={serializedAdvances}
          advanceLimit={settings.cashAdvanceLimit}
        />
      </div>
    </DashboardLayout>
  );
}
