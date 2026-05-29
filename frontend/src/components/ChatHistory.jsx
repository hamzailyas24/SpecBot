import { useState, useEffect, useCallback } from "react";
import { Clock, Trash2, ChevronDown, ChevronUp, Zap } from "lucide-react";
import api from "../api/client.js";
import toast from "react-hot-toast";

function HistoryItem({ item }) {
  const [open, setOpen] = useState(false);
  const time = new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div className="border border-border rounded-xl overflow-hidden hover:border-accent/20 transition-colors">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-elevated/50 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-txt truncate">{item.message}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted font-mono">{date} {time}</span>
            {item.cached && <span className="flex items-center gap-0.5 text-accent text-xs"><Zap size={9} />cached</span>}
          </div>
        </div>
        <span className="text-muted mt-0.5 flex-shrink-0">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-border">
          <div className="mt-3 text-xs text-subtle leading-relaxed bg-surface rounded-lg p-3 prose-ai"
            dangerouslySetInnerHTML={{ __html: item.response.slice(0, 400) + (item.response.length > 400 ? "…" : "") }} />
        </div>
      )}
    </div>
  );
}

export default function ChatHistory({ trigger }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/chat/history?limit=30");
      setHistory(data);
    } catch { toast.error("Failed to load history"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, trigger]);

  const clearAll = async () => {
    try {
      await api.delete("/chat/history");
      setHistory([]);
      toast.success("History cleared");
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Clock size={13} className="text-accent" />
        <span className="text-sm font-display font-semibold">History</span>
        <span className="badge-subtle ml-auto">{history.length}</span>
        {history.length > 0 && (
          <button onClick={clearAll} className="text-muted hover:text-red-400 transition-colors ml-1">
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {loading
          ? [...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer-bg bg-elevated" />)
          : history.length === 0
            ? <div className="text-center py-10"><Clock size={26} className="text-border mx-auto mb-3" /><p className="text-subtle text-sm">No history yet</p></div>
            : history.map((item) => <HistoryItem key={item.id} item={item} />)
        }
      </div>
    </div>
  );
}
