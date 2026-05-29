import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";
import { Eye, EyeOff, Zap } from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const [form, setForm] = useState({ email: "", password: "" });
  const [show, setShow] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back!`);
      const fallback = user.role === "admin" ? "/admin" : "/dashboard";
      navigate(from && from !== "/login" ? from : fallback, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <main className="min-h-screen bg-void pt-16 flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/4 rounded-full blur-[110px]" />
      </div>
      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/30">
            <Zap size={17} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl">Spec<span className="text-accent">Bot</span></span>
        </div>
        <div className="card">
          <h1 className="font-display font-bold text-2xl mb-1">Welcome back</h1>
          <p className="text-subtle text-sm mb-6">Sign in to continue</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-subtle mb-1.5">Email</label>
              <input type="email" required autoComplete="email" className="input-field"
                placeholder="you@example.com" value={form.email} onChange={set("email")} />
            </div>
            <div>
              <label className="block text-xs text-subtle mb-1.5">Password</label>
              <div className="relative">
                <input type={show ? "text" : "password"} required className="input-field pr-10"
                  placeholder="••••••••" value={form.password} onChange={set("password")} />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-subtle transition-colors">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-1">
              {loading ? <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…
              </span> : "Sign in"}
            </button>
          </form>
        </div>
        <p className="text-center text-subtle text-sm mt-4">
          No account? <Link to="/register" className="text-accent hover:text-glow transition-colors">Create one</Link>
        </p>
      </div>
    </main>
  );
}
