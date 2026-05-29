import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";
import { ArrowRight, Cpu, Search, Star, Zap, MessageSquare, GitCompare, Database, Shield } from "lucide-react";

const FEATURES = [
  { icon: MessageSquare, title: "AI Chat",            desc: "Ask anything in plain English. Powered by Llama 3.3 70B with real spec data as context." },
  { icon: GitCompare,    title: "Side-by-side Compare", desc: "Pick any two phones. Get an AI-generated breakdown of specs, category winners, and a final verdict." },
  { icon: Search,        title: "Full-text Search",   desc: "PostgreSQL tsvector + trigram search across 24,786 phones. Blazing fast, no AI needed." },
  { icon: Star,          title: "Smart Recommendations", desc: "Personalized picks based on your saved phones. Vector similarity via ChromaDB." },
  { icon: Database,      title: "24,786 Phones",      desc: "Complete dataset covering 2016–2026. Every spec column imported and indexed." },
  { icon: Shield,        title: "Redis Caching",      desc: "Repeated queries return instantly. Cache hit rate tracked in the admin panel." },
];

const PROMPTS = [
  "Compare iPhone 15 Pro vs Galaxy S24 Ultra",
  "Best camera phone under $400",
  "Flagship with 7000mAh battery 2024",
  "Samsung phones with SD card 2023",
  "Lightest 5G phone released in 2025",
];

export default function Home() {
  const { user } = useAuthStore();
  const dest = user ? "/dashboard" : "/register";
  const compareDest = user ? "/compare" : "/login";

  return (
    <main className="min-h-screen bg-void pt-16 overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-accent/5 rounded-full blur-[140px]" />
      </div>

      {/* Hero */}
      <section className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
          bg-accent/10 border border-accent/20 text-accent text-xs font-mono mb-8 animate-fade-up">
          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-slow" />
          24,786 phones · Llama 3.3 70B · Vector search · Redis cache
        </div>

        <h1 className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.05]
          tracking-tight mb-6 animate-fade-up" style={{ animationDelay: "80ms" }}>
          The smartest way<br />
          <span className="text-gradient">to research phones</span>
        </h1>

        <p className="text-subtle text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up"
          style={{ animationDelay: "160ms" }}>
          Ask in plain English. Compare any two phones side-by-side. Get AI recommendations
          grounded in real spec data — completely free.
        </p>

        <div className="flex items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: "240ms" }}>
          <Link to={dest} className="btn-primary flex items-center gap-2 py-3 px-7 text-base">
            {user ? "Open dashboard" : "Start for free"}
            <ArrowRight size={16} />
          </Link>
          <Link to={compareDest} className="btn-ghost flex items-center gap-2 py-3 px-6 text-base">
            <GitCompare size={15} />
            Compare phones
          </Link>
        </div>

        {/* Sample prompts */}
        <div className="mt-14 flex flex-wrap justify-center gap-2 animate-fade-up" style={{ animationDelay: "300ms" }}>
          {PROMPTS.map((p) => (
            <Link key={p} to={dest}
              className="text-xs text-subtle font-mono px-3 py-1.5 rounded-lg
              bg-elevated border border-border hover:border-accent/40 hover:text-txt
              transition-all duration-200">
              "{p}"
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative max-w-6xl mx-auto px-6 pb-28">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card-hover group animate-fade-up opacity-0" style={{ animationFillMode: "forwards" }}>
              <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20
                flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <Icon size={17} className="text-accent" />
              </div>
              <h3 className="font-display font-semibold text-txt mb-2 text-sm">{title}</h3>
              <p className="text-subtle text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
