import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import AddEmployeeForm from "./AddEmployeeForm";

export default async function NewEmployeePage() {
  const session = await getSession();
  if (!session || session.role === "EMPLOYEE") redirect("/login");

  const currentUser = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : session.email;

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const sites = await prisma.projectSite.findMany({ orderBy: { name: "asc" } });
  const skills = await prisma.skill.findMany({ orderBy: { name: "asc" } });

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <a href="/employees" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Employees
        </a>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Add New Employee</h1>

        <AddEmployeeForm
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          skills={skills.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>
    </DashboardLayout>
  );
}
