import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";
import { Eye, EyeOff, Zap } from "lucide-react";
import toast from "react-hot-toast";

export default function Register() {
  const { register, loading } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8)
      return toast.error("Password must be 8+ characters");
    try {
      await register(form.name, form.email, form.password);
      toast.success("Account created!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.errors?.[0]?.msg ||
          "Registration failed",
      );
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
          <span className="font-display font-bold text-xl">
            Spec<span className="text-accent">Bot</span>
          </span>
        </div>
        <div className="card">
          <h1 className="font-display font-bold text-2xl mb-1">
            Create account
          </h1>
          <p className="text-subtle text-sm mb-6">
            Start researching phones for free
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              ["Name", "text", "name", "Your name", false],
              ["Email", "email", "email", "you@example.com", false],
            ].map(([label, type, key, ph]) => (
              <div key={key}>
                <label className="block text-xs text-subtle mb-1.5">
                  {label}
                </label>
                <input
                  type={type}
                  required
                  className="input-field"
                  placeholder={ph}
                  value={form[key]}
                  onChange={set(key)}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-subtle mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  required
                  minLength={8}
                  className="input-field pr-10"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={set("password")}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-subtle transition-colors"
                >
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>
        </div>
        <p className="text-center text-subtle text-sm mt-4">
          Have an account?{" "}
          <Link
            to="/login"
            className="text-accent hover:text-glow transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
