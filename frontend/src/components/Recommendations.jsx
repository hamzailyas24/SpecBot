import { useState, useEffect } from "react";
import { Sparkles, Smartphone } from "lucide-react";
import api from "../api/client.js";

export default function Recommendations() {
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/user/recommendations")
      .then(({ data }) => setPhones(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Sparkles size={13} className="text-accent" />
        <span className="text-sm font-display font-semibold">For You</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {loading
          ? [...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl shimmer-bg bg-elevated" />)
          : phones.length === 0
            ? <div className="text-center py-10"><Sparkles size={26} className="text-border mx-auto mb-3" /><p className="text-subtle text-sm">Save favorites to get picks</p></div>
            : phones.map((p) => (
              <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-border hover:border-accent/25 transition-all duration-200">
                <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center flex-shrink-0">
                  <Smartphone size={12} className="text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-subtle">{p.brand}</p>
                  <p className="text-sm font-display font-medium text-txt truncate">{p.model}</p>
                  {p.year && <p className="text-xs text-muted font-mono">{p.year}</p>}
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}
