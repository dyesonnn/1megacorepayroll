import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import CashAdvanceSheet from "./CashAdvanceSheet";

export default async function CashAdvanceSheetPage({
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
    month = m - 1;
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

  // Get cash advances for this month
  const advances = await prisma.cashAdvance.findMany({
    where: {
      advanceDate: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      employee: {
        select: { employeeNumber: true, firstName: true, lastName: true },
      },
    },
    orderBy: { advanceDate: "asc" },
  });

  // Build cash advance map: employeeId -> date -> total amount
  const advanceMap = new Map<string, Map<string, number>>();
  for (const advance of advances) {
    const dateKey = advance.advanceDate.toISOString().split("T")[0];
    if (!advanceMap.has(advance.employeeId)) {
      advanceMap.set(advance.employeeId, new Map());
    }
    const dayMap = advanceMap.get(advance.employeeId)!;
    dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + advance.amount);
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

  // Serialize advance map
  const serializedAdvances: Record<string, Record<string, number>> = {};
  for (const [empId, dateMap] of advanceMap) {
    serializedAdvances[empId] = {};
    for (const [dateKey, amount] of dateMap) {
      serializedAdvances[empId][dateKey] = amount;
    }
  }

  // Total advances per employee for the month
  const totalPerEmployee: Record<string, number> = {};
  for (const [empId, dateMap] of advanceMap) {
    totalPerEmployee[empId] = Array.from(dateMap.values()).reduce((s, v) => s + v, 0);
  }

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Monthly Cash Advance Sheet</h1>
          <p className="text-slate-500 mt-1">
            View cash advances for each employee by day
          </p>
        </div>
        <CashAdvanceSheet
          employees={serializedEmployees}
          advances={serializedAdvances}
          totalPerEmployee={totalPerEmployee}
          year={year}
          month={month}
          daysInMonth={daysInMonth}
        />
      </div>
    </DashboardLayout>
  );
}
