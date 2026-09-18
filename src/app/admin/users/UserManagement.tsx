"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

interface User {
  id: string;
  email: string;
  role: string;
  employeeName: string;
  employeeNumber: string;
  createdAt: string;
}

interface UserManagementProps {
  users: User[];
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  HR: "bg-blue-100 text-blue-700",
  EMPLOYEE: "bg-green-100 text-green-700",
};

export default function UserManagement({ users }: UserManagementProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setMessage("");

    if (newPassword.length < 8) {
      setMessage("New password must be at least 8 characters");
      return;
    }

    setLoading(resetUser.id);
    try {
      const res = await fetch("/api/auth/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetUser.id, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Failed to reset password");
        return;
      }

      setMessage(`Password reset for ${resetUser.email}`);
      setResetUser(null);
      setNewPassword("");
      router.refresh();
    } catch {
      setMessage("Connection error");
    } finally {
      setLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setLoading(userId);
    setMessage("");

    try {
      const res = await fetch(`/api/auth/users?id=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Failed to update role");
        return;
      }

      setMessage("Role updated successfully");
      router.refresh();
    } catch {
      setMessage("Connection error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg px-4 py-3 mb-4">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Employee</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Role</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Created</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{user.email}</td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{user.employeeName}</p>
                  <p className="text-xs text-slate-500">{user.employeeNumber}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${roleColors[user.role] || "bg-slate-100 text-slate-600"}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(user.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={loading === user.id}
                      className="px-2 py-1 border border-slate-300 rounded text-xs bg-white disabled:opacity-50"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="HR">HR Staff</option>
                      <option value="EMPLOYEE">Employee</option>
                    </select>
                    <button
                      onClick={() => {
                        setResetUser(user);
                        setNewPassword("");
                        setMessage("");
                      }}
                      disabled={loading === user.id}
                      className="px-2 py-1 border border-slate-300 rounded text-xs bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reset PW
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Reset Password</h2>
            <p className="text-sm text-slate-500 mb-4">
              Set a new password for <span className="font-medium text-slate-700">{resetUser.email}</span>.
              They stay logged in until their session expires.
            </p>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              minLength={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setResetUser(null)}
                className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={loading === resetUser.id || newPassword.length < 8}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading === resetUser.id ? "Saving..." : "Save Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
