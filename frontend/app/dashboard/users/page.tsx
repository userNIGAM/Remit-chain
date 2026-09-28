"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  Loader2,
  Search,
  ShieldCheck,
  UserPlus,
  UserX,
} from "lucide-react";

import { api } from "@/lib/api";

type UserRole = "sender" | "receiver" | "agent" | "supervisor" | "admin";

type User = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  remitId: string;
  verificationStatus: "pending" | "verified" | "rejected";
  isActive: boolean;
  address?: string;
  country?: string;
};

type CurrentUser = {
  id: string;
  role: UserRole;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateStaff, setShowCreateStaff] = useState(false);

  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "agent" as "agent" | "supervisor",
    address: "",
    country: "Nepal",
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const [usersResponse, meResponse] = await Promise.all([
        api<{ users: User[] }>("/users"),
        api<{ user: { _id?: string; id?: string; role: UserRole } }>(
          "/auth/me",
        ),
      ]);

      setUsers(usersResponse.users || []);
      setCurrentUser({
        id: meResponse.user._id || meResponse.user.id || "",
        role: meResponse.user.role,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleVerify = async (userId: string) => {
    try {
      setActionLoading(userId);
      setError("");

      await api(`/users/${userId}/verify`);

      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to verify user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    try {
      setActionLoading(userId);
      setError("");

      await api(`/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });

      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to update user status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateStaff = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setActionLoading("create-staff");
      setError("");

      await api("/users/staff", {
        method: "POST",
        body: JSON.stringify(staffForm),
      });

      setStaffForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "agent",
        address: "",
        country: "Nepal",
      });

      setShowCreateStaff(false);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to create staff account");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      user.name.toLowerCase().includes(searchText) ||
      user.email.toLowerCase().includes(searchText) ||
      user.phone.includes(search) ||
      user.remitId.toLowerCase().includes(searchText);

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.isActive) ||
      (statusFilter === "inactive" && !user.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const isAdmin = currentUser?.role === "admin";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              User Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage RemitChain users, staff accounts and verification.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowCreateStaff(!showCreateStaff)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              <UserPlus size={18} />
              Create Staff
            </button>
          )}
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {showCreateStaff && isAdmin && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Create Staff Account
              </h2>
              <p className="text-sm text-gray-500">
                Create an Agent or Supervisor account.
              </p>
            </div>

            <form
              onSubmit={handleCreateStaff}
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              <input
                type="text"
                placeholder="Full name"
                required
                value={staffForm.name}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, name: e.target.value })
                }
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500"
              />

              <input
                type="email"
                placeholder="Email"
                required
                value={staffForm.email}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, email: e.target.value })
                }
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500"
              />

              <input
                type="text"
                placeholder="Phone"
                required
                value={staffForm.phone}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, phone: e.target.value })
                }
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500"
              />

              <input
                type="password"
                placeholder="Password"
                required
                minLength={6}
                value={staffForm.password}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, password: e.target.value })
                }
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500"
              />

              <div className="relative">
                <select
                  value={staffForm.role}
                  onChange={(e) =>
                    setStaffForm({
                      ...staffForm,
                      role: e.target.value as "agent" | "supervisor",
                    })
                  }
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-500"
                >
                  <option value="agent">Agent</option>
                  <option value="supervisor">Supervisor</option>
                </select>

                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-3 top-3 text-gray-400"
                />
              </div>

              <input
                type="text"
                placeholder="Country"
                value={staffForm.country}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, country: e.target.value })
                }
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500"
              />

              <input
                type="text"
                placeholder="Address"
                value={staffForm.address}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, address: e.target.value })
                }
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 md:col-span-2"
              />

              <div className="flex gap-3 md:col-span-2">
                <button
                  type="submit"
                  disabled={actionLoading === "create-staff"}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {actionLoading === "create-staff" && (
                    <Loader2 size={17} className="animate-spin" />
                  )}
                  Create Staff
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateStaff(false)}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-3 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search name, email or Remit ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-green-500"
              />
            </div>

            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-500"
              >
                <option value="all">All Roles</option>
                <option value="sender">Sender</option>
                <option value="receiver">Receiver</option>
                <option value="agent">Agent</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>

              <ChevronDown
                size={18}
                className="pointer-events-none absolute right-3 top-3 text-gray-400"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <ChevronDown
                size={18}
                className="pointer-events-none absolute right-3 top-3 text-gray-400"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-green-600" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-500">No users found.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        User
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Role
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Remit ID
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Verification
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Status
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.map((user) => (
                      <tr key={user._id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          <p className="text-xs text-gray-500">{user.phone}</p>
                        </td>

                        <td className="px-5 py-4">
                          <RoleBadge role={user.role} />
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-gray-700">
                          {user.remitId}
                        </td>

                        <td className="px-5 py-4">
                          <VerificationBadge
                            status={user.verificationStatus}
                          />
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge isActive={user.isActive} />
                        </td>

                        <td className="px-5 py-4">
                          {actionLoading === user._id ? (
                            <Loader2
                              size={19}
                              className="animate-spin text-gray-500"
                            />
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {user.verificationStatus !== "verified" && (
                                <button
                                  onClick={() => handleVerify(user._id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-green-200 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                                >
                                  <ShieldCheck size={14} />
                                  Verify
                                </button>
                              )}

                              {user._id !== currentUser?.id && (
                                <button
                                  onClick={() =>
                                    handleStatusChange(user._id, !user.isActive)
                                  }
                                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                                    user.isActive
                                      ? "border-red-200 text-red-700 hover:bg-red-50"
                                      : "border-green-200 text-green-700 hover:bg-green-50"
                                  }`}
                                >
                                  <UserX size={14} />
                                  {user.isActive ? "Deactivate" : "Activate"}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-gray-100 md:hidden">
                {filteredUsers.map((user) => (
                  <div key={user._id} className="p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        <p className="text-xs text-gray-500">{user.phone}</p>
                      </div>

                      <RoleBadge role={user.role} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Remit ID</p>
                        <p className="font-medium text-gray-700">
                          {user.remitId}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">Status</p>
                        <StatusBadge isActive={user.isActive} />
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">Verification</p>
                        <VerificationBadge status={user.verificationStatus} />
                      </div>
                    </div>

                    {user._id !== currentUser?.id && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {user.verificationStatus !== "verified" && (
                          <button
                            onClick={() => handleVerify(user._id)}
                            className="rounded-md border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700"
                          >
                            Verify
                          </button>
                        )}

                        <button
                          onClick={() =>
                            handleStatusChange(user._id, !user.isActive)
                          }
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-400">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </div>
    </main>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const labels: Record<UserRole, string> = {
    sender: "Sender",
    receiver: "Receiver",
    agent: "Agent",
    supervisor: "Supervisor",
    admin: "Admin",
  };

  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
      {labels[role]}
    </span>
  );
}

function VerificationBadge({
  status,
}: {
  status: "pending" | "verified" | "rejected";
}) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle size={13} />
        Verified
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        Rejected
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700">
      Pending
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}