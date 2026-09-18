"use client";

import { useState } from "react";

interface Site {
  id: string;
  name: string;
  location: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { employees: number };
}

interface SiteManagementProps {
  initialSites: Site[];
}

export default function SiteManagement({ initialSites }: SiteManagementProps) {
  const [sites, setSites] = useState(initialSites);
  const [showForm, setShowForm] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setShowForm(false);
    setEditingSite(null);
    setError("");
  };

  const handleAdd = () => {
    setEditingSite(null);
    setShowForm(true);
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this site?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/sites?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete site");
        return;
      }
      setSites(sites.filter((s) => s.id !== id));
    } catch {
      alert("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      location: form.get("location") as string,
      description: form.get("description") as string || null,
      isActive: form.get("isActive") === "on",
    };

    try {
      const url = editingSite ? `/api/sites?id=${editingSite.id}` : "/api/sites";
      const method = editingSite ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || "Failed to save site");
        return;
      }

      const savedSite = await res.json();

      if (editingSite) {
        setSites(sites.map((s) => (s.id === editingSite.id ? { ...savedSite, _count: editingSite._count } : s)));
      } else {
        setSites([{ ...savedSite, _count: { employees: 0 } }, ...sites]);
      }

      resetForm();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-500">
          {sites.length} site{sites.length !== 1 ? "s" : ""} total
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Site
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editingSite ? "Edit Site" : "Add New Site"}
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Site Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingSite?.name || ""}
                  required
                  placeholder="e.g., BGC Tower Project"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  name="location"
                  defaultValue={editingSite?.location || ""}
                  required
                  placeholder="e.g., Bonifacio Global City, Taguig"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  name="description"
                  defaultValue={editingSite?.description || ""}
                  rows={3}
                  placeholder="Brief description of the project..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={editingSite?.isActive ?? true}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label className="text-sm text-slate-700">Active Site</label>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Saving..." : editingSite ? "Save Changes" : "Add Site"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sites List */}
      {sites.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-slate-400 text-4xl mb-4">🏗️</div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No project sites yet</h3>
          <p className="text-slate-500 mb-4">Add your first project site to get started</p>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add First Site
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
                site.isActive ? "border-slate-200" : "border-slate-200 opacity-60"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{site.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">📍 {site.location}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    site.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {site.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {site.description && (
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{site.description}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-sm text-slate-500">
                  👷 {site._count.employees} employee{site._count.employees !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(site)}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(site.id)}
                    disabled={loading || site._count.employees > 0}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={site._count.employees > 0 ? "Reassign employees before deleting" : "Delete site"}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
