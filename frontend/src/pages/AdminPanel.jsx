import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Smartphone,
  Users,
  MessageSquare,
  Activity,
  Play,
  RefreshCw,
  Database,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Zap,
  Server,
  Download,
  UserCog,
} from "lucide-react";
import api from "../api/client.js";
import toast from "react-hot-toast";

// ─── Stat Card ───────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "accent" }) {
  const c = {
    accent: "text-accent bg-accent/10 border-accent/20",
    green: "text-green-400 bg-green-400/10 border-green-400/20",
    blue: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    purple: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  };
  return (
    <div className="card flex items-center gap-4">
      <div
        className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${c[color]}`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-display font-bold text-txt">
          {value ?? "—"}
        </p>
        <p className="text-xs text-subtle font-body">{label}</p>
        {sub && <p className="text-xs text-muted font-mono mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState({
    import: false,
    embed: false,
    cache: false,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [{ data: s }, { data: r }] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/import-runs"),
      ]);
      setStats(s);
      setRuns(r);
    } catch {
      toast.error("Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const action = async (key, endpoint, msg) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      await api.post(endpoint);
      toast.success(msg);
      setTimeout(load, 1500);
    } catch {
      toast.error(`Failed: ${key}`);
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const flushCache = async () => {
    setBusy((b) => ({ ...b, cache: true }));
    try {
      await api.delete("/admin/cache");
      toast.success("Cache flushed");
    } catch {
      toast.error("Cache flush failed");
    } finally {
      setBusy((b) => ({ ...b, cache: false }));
    }
  };

  const embedMap = stats?.embeddings || {};

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard
          icon={Smartphone}
          label="Total Phones"
          value={loading ? "…" : stats?.totalPhones?.toLocaleString()}
          color="accent"
        />
        <StatCard
          icon={Users}
          label="Total Users"
          value={loading ? "…" : stats?.totalUsers?.toLocaleString()}
          color="blue"
        />
        <StatCard
          icon={MessageSquare}
          label="Total Chats"
          value={loading ? "…" : stats?.totalChats?.toLocaleString()}
          color="purple"
        />
        <StatCard
          icon={Zap}
          label="Cache Hit Rate"
          value={loading ? "…" : `${stats?.cacheHitRate ?? 0}%`}
          sub={stats?.redisOnline ? "Redis online" : "Redis offline"}
          color="green"
        />
      </div>

      {/* Action buttons */}
      <div className="card">
        <h2 className="font-display font-semibold text-sm mb-4">
          System Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() =>
              action("import", "/admin/import", "Import started in background")
            }
            disabled={busy.import}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {busy.import ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {busy.import ? "Starting…" : "Run Import"}
          </button>

          <button
            onClick={() =>
              action("embed", "/admin/embed", "Embedding queue started")
            }
            disabled={busy.embed}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            {busy.embed ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Activity size={14} />
            )}
            {busy.embed ? "Starting…" : "Process Embeddings"}
          </button>

          <button
            onClick={flushCache}
            disabled={busy.cache}
            className="btn-danger flex items-center gap-2 text-sm"
          >
            {busy.cache ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Flush Cache
          </button>

          <button
            onClick={load}
            className="btn-ghost flex items-center gap-2 text-sm ml-auto"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Embedding status */}
      {Object.keys(embedMap).length > 0 && (
        <div className="card">
          <h2 className="font-display font-semibold text-sm mb-3">
            Embedding Queue
          </h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(embedMap).map(([status, count]) => (
              <div
                key={status}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono
                ${
                  status === "done"
                    ? "bg-green-400/10 border-green-400/20 text-green-400"
                    : status === "failed"
                      ? "bg-red-400/10 border-red-400/20 text-red-400"
                      : "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
                }`}
              >
                {status === "done" && <CheckCircle size={12} />}
                {status === "failed" && <XCircle size={12} />}
                {status === "pending" && (
                  <Loader2 size={12} className="animate-spin" />
                )}
                {status}: {parseInt(count).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import history */}
      {runs.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-display font-semibold text-sm">
              Import History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-body">
              <thead>
                <tr className="text-muted border-b border-border text-left">
                  {[
                    "Status",
                    "Imported",
                    "Skipped",
                    "Errors",
                    "Total",
                    "Date",
                  ].map((h) => (
                    <th key={h} className="px-5 py-2.5 font-body">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-elevated/30 transition-colors"
                  >
                    <td className="px-5 py-2.5">
                      <span
                        className={`badge ${r.status === "completed" ? "badge-green" : r.status === "running" ? "badge-yellow" : "badge-red"}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-green-400 font-mono">
                      {r.imported?.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-yellow-400 font-mono">
                      {r.skipped?.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-red-400 font-mono">
                      {r.errors?.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-subtle font-mono">
                      {r.total?.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-muted font-mono whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Phone Browser Tab ────────────────────────────────────────────
function PhoneBrowserTab() {
  const [phones, setPhones] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const search = useCallback(async (q, p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p });
      if (q) params.set("q", q);
      const { data } = await api.get(`/admin/phones?${params}`);
      setPhones(data.phones);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query, 1), 350);
    return () => clearTimeout(t);
  }, [query, search]);

  const loadPhone = async (id) => {
    try {
      const { data } = await api.get(`/admin/phones/${id}`);
      setSelected(data);
    } catch {
      toast.error("Failed to load phone");
    }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)]">
      {/* List */}
      <div className="flex-1 flex flex-col min-w-0 bg-elevated border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${total.toLocaleString()} phones…`}
              className="input-field pl-9 py-2 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-lg shimmer-bg bg-surface"
                />
              ))}
            </div>
          ) : (
            <table className="w-full text-xs font-body">
              <thead className="sticky top-0 bg-elevated border-b border-border">
                <tr className="text-muted text-left">
                  {["Brand", "Model", "Year", "RAM", "Battery"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-body">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {phones.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => loadPhone(p.id)}
                    className={`hover:bg-surface transition-colors cursor-pointer
                      ${selected?.id === p.id ? "bg-accent/5 border-l-2 border-accent" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-subtle">{p.brand}</td>
                    <td className="px-4 py-2.5 text-txt font-medium max-w-[180px] truncate">
                      {p.model}
                    </td>
                    <td className="px-4 py-2.5 text-muted font-mono">
                      {p.year || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted font-mono">
                      {p.ram || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted font-mono">
                      {p.battery || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <button
              onClick={() => search(query, page - 1)}
              disabled={page <= 1}
              className="text-muted hover:text-subtle disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-mono text-subtle">
              {page.toLocaleString()} / {pages.toLocaleString()} ·{" "}
              {total.toLocaleString()} phones
            </span>
            <button
              onClick={() => search(query, page + 1)}
              disabled={page >= pages}
              className="text-muted hover:text-subtle disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Detail panel */}
      <div className="w-80 flex-shrink-0 bg-elevated border border-border rounded-2xl overflow-hidden flex flex-col">
        {selected ? (
          <>
            <div className="p-4 border-b border-border">
              <p className="text-xs text-subtle">{selected.brand}</p>
              <h3 className="font-display font-bold text-txt">
                {selected.model}
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-muted hover:text-subtle mt-1 transition-colors"
              >
                ← Back
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              <div className="space-y-1">
                {Object.entries(selected.specs || {})
                  .slice(0, 60)
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="flex gap-2 py-1.5 border-b border-border/50 last:border-0"
                    >
                      <span
                        className="text-xs text-muted font-mono flex-shrink-0 w-36 truncate"
                        title={k}
                      >
                        {k}
                      </span>
                      <span className="text-xs text-subtle flex-1 min-w-0 break-words">
                        {v}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-6">
            <div>
              <Smartphone size={32} className="text-border mx-auto mb-3" />
              <p className="text-subtle text-sm font-body">
                Click a phone to see full specs
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/users?page=${p}`);
      setUsers(data);
      setPage(p);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRole = async (user) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    try {
      await api.patch(`/admin/users/${user.id}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)),
      );
      toast.success(`${user.name} is now ${newRole}`);
    } catch {
      toast.error("Failed to update role");
    }
  };

  return (
    <div className="card overflow-hidden p-0">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h2 className="font-display font-semibold text-sm">Users</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1}
            className="text-muted hover:text-subtle disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-mono text-subtle">Page {page}</span>
          <button
            onClick={() => load(page + 1)}
            disabled={users.length < 30}
            className="text-muted hover:text-subtle disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg shimmer-bg bg-surface" />
          ))}
        </div>
      ) : (
        <table className="w-full text-xs font-body">
          <thead className="text-muted text-left border-b border-border">
            <tr>
              {["Name", "Email", "Role", "Joined"].map((h) => (
                <th key={h} className="px-5 py-2.5 font-body">
                  {h}
                </th>
              ))}
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-elevated/30 transition-colors">
                <td className="px-5 py-3 text-txt font-medium">{u.name}</td>
                <td className="px-5 py-3 text-subtle font-mono">{u.email}</td>
                <td className="px-5 py-3">
                  <span
                    className={
                      u.role === "admin" ? "badge-accent" : "badge-subtle"
                    }
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-muted font-mono whitespace-nowrap">
                  {new Date(u.created_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  })}
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => toggleRole(u)}
                    className="text-xs text-muted hover:text-subtle border border-border hover:border-muted
                    px-2.5 py-1 rounded-lg transition-all duration-200 flex items-center gap-1"
                  >
                    <UserCog size={11} />
                    {u.role === "admin" ? "Demote" : "Promote"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "Overview", icon: Server },
  { id: "phones", label: "Phone Browser", icon: Smartphone },
  { id: "users", label: "Users", icon: Users },
];

export default function AdminPanel() {
  const [tab, setTab] = useState("overview");

  return (
    <main className="min-h-screen bg-void pt-16">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Shield size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl">Admin Panel</h1>
            <p className="text-subtle text-sm">System control · SpecBot</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-elevated border border-border rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body transition-all duration-200
                ${tab === id ? "bg-accent text-white font-semibold shadow-lg shadow-accent/20" : "text-subtle hover:text-txt"}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab />}
        {tab === "phones" && <PhoneBrowserTab />}
        {tab === "users" && <UsersTab />}
      </div>
    </main>
  );
}
