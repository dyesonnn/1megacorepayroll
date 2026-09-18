import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import EmployeesList from "./EmployeesList";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role === "EMPLOYEE") redirect("/dashboard");

  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : session.email;

  const params = await searchParams;
  const departmentFilter = typeof params.department === "string" ? params.department : undefined;
  const statusFilter = typeof params.status === "string" ? params.status : undefined;
  const siteFilter = typeof params.site === "string" ? params.site : undefined;

  const where: Record<string, unknown> = {};
  if (departmentFilter) where.departmentId = departmentFilter;
  if (statusFilter) where.employmentStatus = statusFilter;
  if (siteFilter) where.projectSiteId = siteFilter;

  const employees = await prisma.employee.findMany({
    where,
    include: { department: true, projectSite: true },
    orderBy: { employeeNumber: "asc" },
  });

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const sites = await prisma.projectSite.findMany({ orderBy: { name: "asc" } });

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Employee Records</h1>
            <p className="text-slate-500 mt-1">{employees.length} employees total</p>
          </div>
          <a
            href="/employees/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Add Employee
          </a>
        </div>

        <EmployeesList
          employees={employees.map((e) => ({
            ...e,
            departmentName: e.department.name,
            siteName: e.projectSite?.name || "—",
          }))}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          currentFilters={{
            department: departmentFilter || "",
            status: statusFilter || "",
            site: siteFilter || "",
          }}
        />
      </div>
    </DashboardLayout>
  );
}
