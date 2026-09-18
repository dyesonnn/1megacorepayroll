"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EmployeeData {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  birthDate: string;
  gender: string;
  civilStatus: string;
  address: string;
  phone: string;
  email: string;
  position: string;
  departmentId: string;
  projectSiteId: string;
  hireDate: string;
  employmentStatus: string;
  dailyRate: number;
  monthlyRate: number;
  sssNumber: string;
  philhealthNumber: string;
  pagibigNumber: string;
  tinNumber: string;
}

interface EditEmployeeFormProps {
  employee: EmployeeData;
  currentSkills: { skillId: string; skillName: string; proficiency: string }[];
  departments: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  allSkills: { id: string; name: string }[];
}

export default function EditEmployeeForm({
  employee,
  currentSkills,
  departments,
  sites,
  allSkills,
}: EditEmployeeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedSkills, setSelectedSkills] = useState(currentSkills);
  const [dailyRate, setDailyRate] = useState(employee.dailyRate);
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState(() => Math.round(employee.monthlyRate / employee.dailyRate) || 26);

  const monthlyRate = dailyRate * workingDaysPerMonth;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch(`/api/employees?id=${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          middleName: form.get("middleName") || null,
          lastName: form.get("lastName"),
          suffix: form.get("suffix") || null,
          birthDate: form.get("birthDate") ? new Date(form.get("birthDate") as string) : null,
          gender: form.get("gender") || null,
          civilStatus: form.get("civilStatus") || null,
          address: form.get("address") || null,
          phone: form.get("phone") || null,
          email: form.get("email") || null,
          position: form.get("position"),
          departmentId: form.get("departmentId"),
          projectSiteId: form.get("projectSiteId") || null,
          hireDate: new Date(form.get("hireDate") as string),
          employmentStatus: form.get("employmentStatus"),
          dailyRate: parseFloat(form.get("dailyRate") as string) || 0,
          monthlyRate: parseFloat(form.get("dailyRate") as string) * (parseInt(form.get("workingDaysPerMonth") as string) || 26) || 0,
          sssNumber: form.get("sssNumber") || null,
          philhealthNumber: form.get("philhealthNumber") || null,
          pagibigNumber: form.get("pagibigNumber") || null,
          tinNumber: form.get("tinNumber") || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update employee");
        return;
      }

      // Update skills
      // First remove all existing skills, then add new ones
      await fetch(`/api/employees/${employee.id}/skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: selectedSkills.map((s) => ({
            skillId: s.skillId,
            proficiency: s.proficiency,
          })),
        }),
      });

      setSuccess("Employee updated successfully!");
      setTimeout(() => {
        router.push(`/employees/${employee.id}`);
      }, 1500);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addSkill = (skillId: string) => {
    if (!selectedSkills.find((s) => s.skillId === skillId)) {
      const skill = allSkills.find((s) => s.id === skillId);
      setSelectedSkills([
        ...selectedSkills,
        { skillId, skillName: skill?.name || "", proficiency: "Beginner" },
      ]);
    }
  };

  const removeSkill = (skillId: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s.skillId !== skillId));
  };

  const updateProficiency = (skillId: string, proficiency: string) => {
    setSelectedSkills(
      selectedSkills.map((s) => (s.skillId === skillId ? { ...s, proficiency } : s))
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}

      {/* Personal Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="First Name" name="firstName" defaultValue={employee.firstName} required />
          <Field label="Middle Name" name="middleName" defaultValue={employee.middleName} />
          <Field label="Last Name" name="lastName" defaultValue={employee.lastName} required />
          <Field label="Suffix" name="suffix" defaultValue={employee.suffix} placeholder="Jr., Sr., III" />
          <Field label="Date of Birth" name="birthDate" type="date" defaultValue={employee.birthDate} />
          <SelectField
            label="Gender"
            name="gender"
            defaultValue={employee.gender}
            options={["", "Male", "Female", "Other"]}
          />
          <SelectField
            label="Civil Status"
            name="civilStatus"
            defaultValue={employee.civilStatus}
            options={["", "Single", "Married", "Widowed", "Separated"]}
          />
          <Field label="Phone" name="phone" defaultValue={employee.phone} placeholder="09XX XXX XXXX" />
          <Field label="Email" name="email" type="email" defaultValue={employee.email} />
          <div className="md:col-span-3">
            <Field label="Address" name="address" defaultValue={employee.address} />
          </div>
        </div>
      </div>

      {/* Employment Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Employment Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Position" name="position" defaultValue={employee.position} required />
          <SelectField
            label="Department"
            name="departmentId"
            defaultValue={employee.departmentId}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            required
          />
          <SelectField
            label="Project Site"
            name="projectSiteId"
            defaultValue={employee.projectSiteId}
            options={[{ value: "", label: "Unassigned" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]}
          />
          <Field label="Hire Date" name="hireDate" type="date" defaultValue={employee.hireDate} required />
          <Field label="Daily Rate (₱)" name="dailyRate" type="number" step="0.01" defaultValue={employee.dailyRate} required onChange={(e) => setDailyRate(parseFloat(e.target.value) || 0)} />
          <Field label="Working Days/Month" name="workingDaysPerMonth" type="number" step="1" min="1" max="31" defaultValue={workingDaysPerMonth} required onChange={(e) => setWorkingDaysPerMonth(parseInt(e.target.value) || 26)} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Rate (₱)</label>
            <input
              type="number"
              name="monthlyRate"
              step="0.01"
              readOnly
              value={monthlyRate.toFixed(2)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
            />
            <p className="text-xs text-slate-400 mt-1">Auto-calculated: {workingDaysPerMonth} days × daily rate</p>
          </div>
          <SelectField
            label="Employment Status"
            name="employmentStatus"
            defaultValue={employee.employmentStatus}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "ON_LEAVE", label: "On Leave" },
              { value: "TERMINATED", label: "Terminated" },
              { value: "ARCHIVED", label: "Archived" },
            ]}
          />
        </div>
      </div>

      {/* Government IDs */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Government IDs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="SSS Number" name="sssNumber" defaultValue={employee.sssNumber} placeholder="XX-XXXXXXXX-X" />
          <Field label="PhilHealth Number" name="philhealthNumber" defaultValue={employee.philhealthNumber} placeholder="XX-XXXXXXXXX-X" />
          <Field label="Pag-IBIG Number" name="pagibigNumber" defaultValue={employee.pagibigNumber} placeholder="XXXX-XXXX-XXXX" />
          <Field label="TIN Number" name="tinNumber" defaultValue={employee.tinNumber} placeholder="XXX-XXX-XXX-XXX" />
        </div>
      </div>

      {/* Skills */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Skills & Certifications</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {allSkills
            .filter((s) => !selectedSkills.find((ss) => ss.skillId === s.id))
            .map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => addSkill(s.id)}
                className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full hover:bg-slate-200 transition-colors"
              >
                + {s.name}
              </button>
            ))}
        </div>
        {selectedSkills.length > 0 && (
          <div className="space-y-2">
            {selectedSkills.map((ss) => (
              <div key={ss.skillId} className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium text-blue-700">{ss.skillName}</span>
                <select
                  value={ss.proficiency}
                  onChange={(e) => updateProficiency(ss.skillId, e.target.value)}
                  className="text-xs px-2 py-1 border border-blue-200 rounded bg-white"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeSkill(ss.skillId)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-3 justify-end">
        <a
          href={`/employees/${employee.id}`}
          className="px-6 py-2.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

/* ── Reusable form field components ────────────────── */

function Field({
  label,
  name,
  type = "text",
  defaultValue = "",
  required = false,
  placeholder = "",
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        onChange={onChange}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue = "",
  options,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: (string | { value: string; label: string })[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        {options.map((opt) => {
          if (typeof opt === "string") {
            return (
              <option key={opt} value={opt}>
                {opt || `-- Select ${label} --`}
              </option>
            );
          }
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}
