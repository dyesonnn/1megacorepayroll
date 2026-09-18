import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <DashboardLayout userRole={session.role} userName={session.email}>
      <div className="p-6">
        <ChangePasswordForm />
      </div>
    </DashboardLayout>
  );
}
