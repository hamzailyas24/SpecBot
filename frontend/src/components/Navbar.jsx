import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";
import { Zap, LayoutDashboard, GitCompare, Shield, LogOut } from "lucide-react";
import toast from "react-hot-toast";

const NAV = [
  { path: "/dashboard", label: "Chat", icon: LayoutDashboard, auth: true },
  { path: "/compare", label: "Compare", icon: GitCompare, auth: true },
  { path: "/admin", label: "Admin", icon: Shield, auth: true, admin: true },
];

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 glass border-b border-border">
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div
            className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center
            transition-all duration-300 group-hover:shadow-lg group-hover:shadow-accent/30"
          >
            <Zap size={15} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg">
            Spec<span className="text-accent">Bot</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.filter((n) => !n.auth || user)
            .filter((n) => !n.admin || user?.role === "admin")
            .map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-body transition-all duration-200
                ${pathname === path ? "bg-accent/10 text-accent" : "text-subtle hover:text-txt hover:bg-elevated"}`}
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}

          {user ? (
            <div className="flex items-center gap-3 ml-2 pl-3 border-l border-border">
              <span className="text-xs text-subtle hidden sm:block">
                {user.name || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="btn-ghost flex items-center gap-1.5 py-2 text-xs"
              >
                <LogOut size={13} />
                Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-2">
              <Link to="/login" className="btn-ghost py-2 text-sm">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary py-2 text-sm">
                Get started
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
