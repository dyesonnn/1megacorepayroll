import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import UserManagement from "./UserManagement";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login");

  const currentUser = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : session.email;

  const users = await prisma.user.findMany({
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">User Account Management</h1>
          <p className="text-slate-500 mt-1">Manage user accounts and roles</p>
        </div>

        <UserManagement
          users={users.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            employeeName: u.employee
              ? `${u.employee.firstName} ${u.employee.lastName}`
              : "—",
            employeeNumber: u.employee?.employeeNumber || "—",
            createdAt: u.createdAt.toISOString(),
          }))}
        />
      </div>
    </DashboardLayout>
  );
}
