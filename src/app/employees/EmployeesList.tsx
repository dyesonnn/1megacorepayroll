"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import DataTable, { type Column } from "@/components/DataTable";
import { formatDate } from "@/lib/utils";

interface EmployeeRow {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  position: string;
  departmentName: string;
  siteName: string;
  employmentStatus: string;
  hireDate: string | Date;
}

interface EmployeesListProps {
  employees: EmployeeRow[];
  departments: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  currentFilters: { department: string; status: string; site: string };
}

/**
 * Lower-cased and accent-free, so "banaria" still finds "Bañaria". Combining
 * accents live in U+0300-U+036F once the name is decomposed.
 */
const normalize = (value: string) =>
  [...value.normalize("NFD")]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("")
    .toLowerCase();

const searchableName = (employee: EmployeeRow) =>
  normalize(
    [employee.firstName, employee.middleName, employee.lastName, employee.suffix]
      .filter(Boolean)
      .join(" "),
  );

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-slate-100 text-slate-600",
  ON_LEAVE: "bg-yellow-100 text-yellow-700",
  TERMINATED: "bg-red-100 text-red-700",
  ARCHIVED: "bg-orange-100 text-orange-700",
};

export default function EmployeesList({ employees, departments, sites, currentFilters }: EmployeesListProps) {
  const router = useRouter();
  const [nameQuery, setNameQuery] = useState("");

  // Names are matched word by word so "banaria jayson" and "jayson banaria"
  // both find the same person.
  const searchWords = normalize(nameQuery)
    .split(/\s+/)
    .filter(Boolean);
  const shown = searchWords.length
    ? employees.filter((employee) => {
        const name = searchableName(employee);
        return searchWords.every((word) => name.includes(word));
      })
    : employees;

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams();
    if (key === "department" && value) params.set("department", value);
    if (key === "status" && value) params.set("status", value);
    if (key === "site" && value) params.set("site", value);
    // Preserve other filters
    if (key !== "department" && currentFilters.department) params.set("department", currentFilters.department);
    if (key !== "status" && currentFilters.status) params.set("status", currentFilters.status);
    if (key !== "site" && currentFilters.site) params.set("site", currentFilters.site);
    router.push(`/employees?${params.toString()}`);
  };

  const columns: Column[] = [
    { key: "employeeNumber", label: "ID", sortable: true, className: "font-mono text-xs" },
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium text-slate-900">{item.firstName} {item.lastName}</p>
          <p className="text-xs text-slate-500">{item.position}</p>
        </div>
      ),
    },
    { key: "departmentName", label: "Department", sortable: true },
    { key: "siteName", label: "Project Site", sortable: true },
    {
      key: "employmentStatus",
      label: "Status",
      sortable: true,
      render: (item) => (
        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[item.employmentStatus] || "bg-slate-100 text-slate-600"}`}>
          {item.employmentStatus}
        </span>
      ),
    },
    {
      key: "hireDate",
      label: "Hire Date",
      sortable: true,
      render: (item) => formatDate(item.hireDate),
    },
    {
      key: "actions",
      label: "",
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(item as unknown as EmployeeRow);
          }}
          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Delete employee"
        >
          🗑️
        </button>
      ),
    },
  ];

  const handleDelete = async (emp: EmployeeRow) => {
    if (!confirm(`Delete ${emp.firstName} ${emp.lastName}? This will permanently remove their records.`)) return;
    try {
      const res = await fetch(`/api/employees?id=${emp.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete employee");
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to delete employee");
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            🔍
          </span>
          <input
            type="text"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search employees by name"
            className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm bg-white sm:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {nameQuery && (
            <button
              type="button"
              onClick={() => setNameQuery("")}
              aria-label="Clear name search"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-sm text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={currentFilters.department}
          onChange={(e) => handleFilterChange("department", e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select
          value={currentFilters.status}
          onChange={(e) => handleFilterChange("status", e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ON_LEAVE">On Leave</option>
          <option value="TERMINATED">Terminated</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        <select
          value={currentFilters.site}
          onChange={(e) => handleFilterChange("site", e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {searchWords.length > 0 && (
          <span className="text-sm text-slate-500">
            {shown.length} of {employees.length} shown
          </span>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={shown}
        pageSize={10}
        onRowClick={(item) => router.push(`/employees/${(item as unknown as EmployeeRow).id}`)}
      />
    </div>
  );
}
