import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import SiteManagement from "./SiteManagement";

export default async function SitesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;
  const userName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : session.email;

  const sites = await prisma.projectSite.findMany({
    include: {
      _count: { select: { employees: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize dates to strings for client component
  const serializedSites = sites.map(site => ({
    ...site,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  }));

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Project Sites</h1>
          <p className="text-slate-500 mt-1">Manage construction sites and project locations</p>
        </div>
        <SiteManagement initialSites={serializedSites} />
      </div>
    </DashboardLayout>
  );
}
