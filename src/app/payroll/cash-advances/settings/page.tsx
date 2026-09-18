import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import { getSettings } from "@/lib/settings";
import CashAdvanceSettingsForm from "./CashAdvanceSettingsForm";

export default async function CashAdvanceSettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login");

  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : session.email;

  const settings = await getSettings();

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Cash Advance Settings</h1>
          <p className="text-slate-500 mt-1">
            System-wide rules that apply to every employee
          </p>
        </div>
        <CashAdvanceSettingsForm
          initialLimit={settings.cashAdvanceLimit}
          initialMaxNetFraction={settings.cashAdvanceMaxNetFraction}
        />
      </div>
    </DashboardLayout>
  );
}
