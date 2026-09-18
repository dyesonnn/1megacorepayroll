"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters" });
      return;
    }
    if (newPassword === currentPassword) {
      setMessage({ type: "error", text: "New password must be different from the current one" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to change password" });
        return;
      }

      setMessage({ type: "success", text: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="max-w-md">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Change Password</h1>
        <p className="text-slate-500 mt-1">
          Update your own login password. You stay logged in after changing it.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 mb-4 text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg border border-slate-200 p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Current Password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
          <p className="text-xs text-slate-400 mt-1">At least 8 characters.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          {loading ? "Changing..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
