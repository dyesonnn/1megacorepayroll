import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import EditEmployeeForm from "./EditEmployeeForm";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role === "EMPLOYEE") redirect("/login");

  const { id } = await params;
  const currentUser = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : session.email;

  const emp = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: true,
      projectSite: true,
      skills: { include: { skill: true } },
    },
  });

  if (!emp) redirect("/employees");

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const sites = await prisma.projectSite.findMany({ orderBy: { name: "asc" } });
  const skills = await prisma.skill.findMany({ orderBy: { name: "asc" } });

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <a href={`/employees/${emp.id}`} className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Profile
        </a>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          Edit Employee: {emp.firstName} {emp.lastName}
        </h1>

        <EditEmployeeForm
          employee={{
            id: emp.id,
            firstName: emp.firstName,
            middleName: emp.middleName || "",
            lastName: emp.lastName,
            suffix: emp.suffix || "",
            birthDate: emp.birthDate ? emp.birthDate.toISOString().split("T")[0] : "",
            gender: emp.gender || "",
            civilStatus: emp.civilStatus || "",
            address: emp.address || "",
            phone: emp.phone || "",
            email: emp.email || "",
            position: emp.position,
            departmentId: emp.departmentId,
            projectSiteId: emp.projectSiteId || "",
            hireDate: emp.hireDate.toISOString().split("T")[0],
            employmentStatus: emp.employmentStatus,
            dailyRate: emp.dailyRate,
            monthlyRate: emp.monthlyRate,
            sssNumber: emp.sssNumber || "",
            philhealthNumber: emp.philhealthNumber || "",
            pagibigNumber: emp.pagibigNumber || "",
            tinNumber: emp.tinNumber || "",
          }}
          currentSkills={emp.skills.map((s) => ({
            skillId: s.skillId,
            skillName: s.skill.name,
            proficiency: s.proficiency || "Beginner",
          }))}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          allSkills={skills.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>
    </DashboardLayout>
  );
}
