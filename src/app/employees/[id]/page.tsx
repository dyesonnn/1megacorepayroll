import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import { formatPeso, formatDate, formatTime } from "@/lib/utils";
import EmployeeActions from "./EmployeeActions";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "EMPLOYEE" && session.employeeId !== (await params).id) redirect("/dashboard");

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
      attendances: {
        orderBy: { date: "desc" },
        take: 14,
        include: { projectSite: true },
      },
      payrollRecords: {
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { payrollPeriod: true },
      },
      skills: { include: { skill: true } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!emp) redirect("/employees");

  return (
    <DashboardLayout userRole={session.role} userName={userName}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <a href="/employees" className="text-sm text-blue-600 hover:underline mb-1 inline-block">
              ← Back to Employees
            </a>
            <h1 className="text-2xl font-bold text-slate-900">
              {emp.firstName} {emp.middleName ? emp.middleName + " " : ""}{emp.lastName}{emp.suffix ? " " + emp.suffix : ""}
            </h1>
            <p className="text-slate-500">
              {emp.employeeNumber} • {emp.position} • {emp.department.name}
            </p>
          </div>
          {session.role !== "EMPLOYEE" && (
            <EmployeeActions employeeId={emp.id} employeeName={`${emp.firstName} ${emp.lastName}`} />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Personal Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoItem label="Date of Birth" value={emp.birthDate ? formatDate(emp.birthDate) : "—"} />
                <InfoItem label="Gender" value={emp.gender || "—"} />
                <InfoItem label="Civil Status" value={emp.civilStatus || "—"} />
                <InfoItem label="Phone" value={emp.phone || "—"} />
                <InfoItem label="Email" value={emp.email || "—"} />
                <InfoItem label="Address" value={emp.address || "—"} />
                <InfoItem label="Project Site" value={emp.projectSite?.name || "—"} />
                <InfoItem label="Hire Date" value={formatDate(emp.hireDate)} />
                <InfoItem label="Status" value={emp.employmentStatus} />
              </div>
            </div>

            {/* Government IDs */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Government IDs</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoItem label="SSS Number" value={emp.sssNumber || "—"} />
                <InfoItem label="PhilHealth Number" value={emp.philhealthNumber || "—"} />
                <InfoItem label="Pag-IBIG Number" value={emp.pagibigNumber || "—"} />
                <InfoItem label="TIN Number" value={emp.tinNumber || "—"} />
              </div>
            </div>

            {/* Compensation */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Compensation</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoItem label="Daily Rate" value={formatPeso(emp.dailyRate)} />
                <InfoItem label="Monthly Rate" value={formatPeso(emp.monthlyRate)} />
              </div>
            </div>

            {/* Skills */}
            {emp.skills.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {emp.skills.map((es) => (
                    <span key={es.id} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
                      {es.skill.name}
                      {es.proficiency && <span className="text-blue-400 text-xs">({es.proficiency})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Attendance */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Attendance</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-2 font-medium text-slate-600">Date</th>
                      <th className="py-2 font-medium text-slate-600">Site</th>
                      <th className="py-2 font-medium text-slate-600">Time In</th>
                      <th className="py-2 font-medium text-slate-600">Time Out</th>
                      <th className="py-2 font-medium text-slate-600">Hours</th>
                      <th className="py-2 font-medium text-slate-600">OT</th>
                      <th className="py-2 font-medium text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.attendances.map((att) => (
                      <tr key={att.id} className="border-b border-slate-100">
                        <td className="py-2">{formatDate(att.date)}</td>
                        <td className="py-2 text-xs">{att.projectSite?.name || "—"}</td>
                        <td className="py-2">{att.timeIn ? formatTime(att.timeIn) : "—"}</td>
                        <td className="py-2">{att.timeOut ? formatTime(att.timeOut) : "—"}</td>
                        <td className="py-2">{att.hoursWorked.toFixed(1)}h</td>
                        <td className="py-2">{att.overtimeHours > 0 ? `${att.overtimeHours.toFixed(1)}h` : "—"}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            att.status === "PRESENT" ? "bg-green-100 text-green-700" :
                            att.status === "LATE" ? "bg-yellow-100 text-yellow-700" :
                            att.status === "ABSENT" ? "bg-red-100 text-red-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {att.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Quick Info */}
          <div className="space-y-6">
            {/* Photo Placeholder */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <div className="w-24 h-24 bg-slate-200 rounded-full mx-auto flex items-center justify-center text-3xl font-bold text-slate-500">
                {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">{emp.position}</h3>
              <p className="text-sm text-slate-500">{emp.department.name}</p>
              <p className="text-xs text-slate-400 mt-1">{emp.projectSite?.name || "Unassigned"}</p>
            </div>

            {/* Compensation Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Pay History</h3>
              {emp.payrollRecords.length === 0 ? (
                <p className="text-sm text-slate-500">No payroll records.</p>
              ) : (
                <div className="space-y-3">
                  {emp.payrollRecords.map((pr) => (
                    <div key={pr.id} className="py-2 border-b border-slate-100 last:border-0">
                      <p className="text-xs text-slate-500">{pr.payrollPeriod.name}</p>
                      <p className="text-sm font-semibold text-slate-900">{formatPeso(pr.netPay)}</p>
                      <p className={`text-xs font-medium ${
                        pr.payrollPeriod.status === "PAID" ? "text-green-600" : "text-yellow-600"
                      }`}>
                        {pr.payrollPeriod.status}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Documents</h3>
              {emp.documents.length === 0 ? (
                <p className="text-sm text-slate-500">No documents uploaded.</p>
              ) : (
                <div className="space-y-2">
                  {emp.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{doc.name}</p>
                        <p className="text-xs text-slate-500">{doc.type}</p>
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(doc.uploadedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}
