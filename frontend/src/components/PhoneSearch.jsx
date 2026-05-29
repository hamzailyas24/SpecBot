import { useState, useEffect, useCallback } from "react";
import { Search, Star, X, Smartphone, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../api/client.js";
import toast from "react-hot-toast";

function PhoneRow({ phone, favorites, onToggleFav }) {
  const isFav = favorites.has(phone.id);
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-border
      hover:border-accent/25 transition-all duration-200 group">
      <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center flex-shrink-0">
        <Smartphone size={12} className="text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-subtle">{phone.brand}</p>
        <p className="text-sm font-display font-medium text-txt truncate">{phone.model}</p>
        <div className="flex gap-2 mt-0.5 flex-wrap">
          {phone.year    && <span className="text-xs text-muted font-mono">{phone.year}</span>}
          {phone.ram     && <span className="text-xs text-muted font-mono">{phone.ram}</span>}
          {phone.battery && <span className="text-xs text-muted font-mono">{phone.battery}</span>}
        </div>
      </div>
      <button onClick={() => onToggleFav(phone)}
        className={`flex-shrink-0 transition-all duration-200 p-0.5
          ${isFav ? "text-accent" : "text-muted hover:text-accent opacity-0 group-hover:opacity-100"}`}>
        <Star size={13} fill={isFav ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export default function PhoneSearch() {
  const [query,   setQuery]   = useState("");
  const [phones,  setPhones]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [loading, setLoading] = useState(false);
  const [favIds,  setFavIds]  = useState(new Set());

  // Load favorites IDs on mount
  useEffect(() => {
    api.get("/user/favorites").then(({ data }) => {
      setFavIds(new Set(data.map((p) => p.id)));
    }).catch(() => {});
  }, []);

  const search = useCallback(async (q, p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p });
      if (q) params.set("q", q);
      const { data } = await api.get(`/user/phones/search?${params}`);
      setPhones(data.phones);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
    } catch { toast.error("Search failed"); }
    finally { setLoading(false); }
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => search(query, 1), 350);
    return () => clearTimeout(t);
  }, [query, search]);

  const toggleFav = async (phone) => {
    const isFav = favIds.has(phone.id);
    try {
      if (isFav) {
        await api.delete(`/user/favorites/${phone.id}`);
        setFavIds((s) => { const n = new Set(s); n.delete(phone.id); return n; });
        toast.success("Removed from favorites");
      } else {
        await api.post(`/user/favorites/${phone.id}`);
        setFavIds((s) => new Set(s).add(phone.id));
        toast.success(`${phone.model} saved`);
      }
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Search size={13} className="text-accent" />
          <span className="text-sm font-display font-semibold">Phone Search</span>
          {total > 0 && <span className="badge-subtle ml-auto">{total.toLocaleString()}</span>}
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 24,786 phones…" className="input-field pl-8 py-2 text-xs" />
          {query && (
            <button onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-subtle">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl shimmer-bg bg-elevated" />
          ))
        ) : phones.length === 0 ? (
          <div className="text-center py-10">
            <Smartphone size={28} className="text-border mx-auto mb-3" />
            <p className="text-subtle text-sm">No phones found</p>
            <p className="text-muted text-xs mt-1">Try a different search</p>
          </div>
        ) : phones.map((p) => (
          <PhoneRow key={p.id} phone={p} favorites={favIds} onToggleFav={toggleFav} />
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <button onClick={() => search(query, page - 1)} disabled={page <= 1}
            className="text-muted hover:text-subtle disabled:opacity-30 transition-colors">
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-mono text-subtle">{page} / {pages}</span>
          <button onClick={() => search(query, page + 1)} disabled={page >= pages}
            className="text-muted hover:text-subtle disabled:opacity-30 transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
