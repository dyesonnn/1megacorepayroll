"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AddEmployeeFormProps {
  departments: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  skills: { id: string; name: string }[];
}

export default function AddEmployeeForm({ departments, sites, skills }: AddEmployeeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<{ skillId: string; proficiency: string }[]>([]);
  const [dailyRate, setDailyRate] = useState(0);
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState(26);

  const monthlyRate = dailyRate * workingDaysPerMonth;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          middleName: form.get("middleName") || null,
          lastName: form.get("lastName"),
          suffix: form.get("suffix") || null,
          birthDate: form.get("birthDate") || null,
          gender: form.get("gender") || null,
          civilStatus: form.get("civilStatus") || null,
          address: form.get("address") || null,
          phone: form.get("phone") || null,
          email: form.get("email") || null,
          position: form.get("position"),
          departmentId: form.get("departmentId"),
          projectSiteId: form.get("projectSiteId") || null,
          hireDate: form.get("hireDate"),
          dailyRate: parseFloat(form.get("dailyRate") as string) || 0,
          monthlyRate: parseFloat(form.get("dailyRate") as string) * (parseInt(form.get("workingDaysPerMonth") as string) || 26) || 0,
          sssNumber: form.get("sssNumber") || null,
          philhealthNumber: form.get("philhealthNumber") || null,
          pagibigNumber: form.get("pagibigNumber") || null,
          tinNumber: form.get("tinNumber") || null,
          skills: selectedSkills,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create employee");
        return;
      }

      router.push(`/employees/${data.id}`);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addSkill = (skillId: string) => {
    if (!selectedSkills.find((s) => s.skillId === skillId)) {
      setSelectedSkills([...selectedSkills, { skillId, proficiency: "Beginner" }]);
    }
  };

  const removeSkill = (skillId: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s.skillId !== skillId));
  };

  const updateProficiency = (skillId: string, proficiency: string) => {
    setSelectedSkills(selectedSkills.map((s) => (s.skillId === skillId ? { ...s, proficiency } : s)));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Personal Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="First Name" name="firstName" required />
          <Input label="Middle Name" name="middleName" />
          <Input label="Last Name" name="lastName" required />
          <Input label="Suffix" name="suffix" placeholder="Jr., Sr., III" />
          <Input label="Date of Birth" name="birthDate" type="date" />
          <Select label="Gender" name="gender" options={["Male", "Female", "Other"]} />
          <Select label="Civil Status" name="civilStatus" options={["Single", "Married", "Widowed", "Separated"]} />
          <Input label="Phone" name="phone" placeholder="09XX XXX XXXX" />
          <Input label="Email" name="email" type="email" />
          <div className="md:col-span-3">
            <Input label="Address" name="address" />
          </div>
        </div>
      </div>

      {/* Employment Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Employment Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Position" name="position" required placeholder="e.g., Welder, Engineer" />
          <Select label="Department" name="departmentId" options={departments.map((d) => ({ value: d.id, label: d.name }))} required />
          <Select label="Project Site" name="projectSiteId" options={[{ value: "", label: "Unassigned" }, ...sites.map((s) => ({ value: s.id, label: s.name }))] } />
          <Input label="Hire Date" name="hireDate" type="date" required />
          <Input label="Daily Rate (₱)" name="dailyRate" type="number" step="0.01" required onChange={(e) => setDailyRate(parseFloat(e.target.value) || 0)} />
          <Input label="Working Days/Month" name="workingDaysPerMonth" type="number" step="1" min="1" max="31" required defaultValue="26" onChange={(e) => setWorkingDaysPerMonth(parseInt(e.target.value) || 26)} />
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
        </div>
      </div>

      {/* Government IDs */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Government IDs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="SSS Number" name="sssNumber" placeholder="XX-XXXXXXXX-X" />
          <Input label="PhilHealth Number" name="philhealthNumber" placeholder="XX-XXXXXXXXX-X" />
          <Input label="Pag-IBIG Number" name="pagibigNumber" placeholder="XXXX-XXXX-XXXX" />
          <Input label="TIN Number" name="tinNumber" placeholder="XXX-XXX-XXX-XXX" />
        </div>
      </div>

      {/* Skills */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Skills</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {skills
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
            {selectedSkills.map((ss) => {
              const skill = skills.find((s) => s.id === ss.skillId);
              return (
                <div key={ss.skillId} className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium text-blue-700">{skill?.name}</span>
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
              );
            })}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-3 justify-end">
        <a
          href="/employees"
          className="px-6 py-2.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Creating..." : "Create Employee"}
        </button>
      </div>
    </form>
  );
}

function Input({
  label,
  name,
  type = "text",
  required = false,
  placeholder = "",
  step,
  min,
  max,
  defaultValue,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue}
        onChange={onChange}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />
    </div>
  );
}

function Select({
  label,
  name,
  options,
  required = false,
}: {
  label: string;
  name: string;
  options: (string | { value: string; label: string })[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        name={name}
        required={required}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      >
        {options.map((opt) => {
          if (typeof opt === "string") {
            return <option key={opt} value={opt}>{opt}</option>;
          }
          return <option key={opt.value} value={opt.value}>{opt.label}</option>;
        })}
      </select>
    </div>
  );
}
