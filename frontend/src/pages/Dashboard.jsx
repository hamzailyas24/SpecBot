import { useState } from "react";
import { MessageSquare, Search, Clock, Sparkles } from "lucide-react";
import { useAuthStore } from "../store/authStore.js";
import Chat           from "../components/Chat.jsx";
import PhoneSearch    from "../components/PhoneSearch.jsx";
import ChatHistory    from "../components/ChatHistory.jsx";
import Recommendations from "../components/Recommendations.jsx";

const TABS = [
  { id: "search", label: "Search",  icon: Search },
  { id: "history", label: "History", icon: Clock },
  { id: "foryou",  label: "For You",  icon: Sparkles },
];

export default function Dashboard() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState("search");
  const [histTrigger, setHistTrigger] = useState(0);

  return (
    <div className="h-screen bg-void pt-16 flex flex-col overflow-hidden">
      <div className="fixed top-16 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/15 to-transparent" />

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto px-4 py-4 gap-4">
        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0 bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-elevated/40 flex items-center gap-3 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <MessageSquare size={12} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-display font-semibold">
                Hey{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
              </p>
              <p className="text-xs text-subtle">Ask anything about smartphones</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <Chat onNewMessage={() => setHistTrigger((t) => t + 1)} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="flex border-b border-border flex-shrink-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-all duration-200
                  border-b-2 font-body
                  ${tab === id ? "border-accent text-accent bg-accent/5" : "border-transparent text-muted hover:text-subtle hover:bg-elevated/40"}`}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === "search"  && <PhoneSearch />}
            {tab === "history" && <ChatHistory trigger={histTrigger} />}
            {tab === "foryou"  && <Recommendations />}
          </div>
        </div>
      </div>
    </div>
  );
}
