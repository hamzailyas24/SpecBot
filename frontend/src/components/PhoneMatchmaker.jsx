import { useState } from "react";
import {
  Sparkles,
  Loader2,
  Star,
  CheckCircle,
  XCircle,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../api/client.js";
import toast from "react-hot-toast";

const EXAMPLES = [
  "I watch YouTube for 4 hours daily and my phone always dies by 3pm. I take lots of food photos at night.",
  "I'm a gamer who needs the fastest processor. I also need a big screen and at least 128GB storage.",
  "I want a lightweight phone with good camera for travel. Battery should last 2 days.",
  "I use my phone for business emails, video calls, and need something that looks premium.",
];

function MatchCard({ match, rank }) {
  const [open, setOpen] = useState(rank === 0);
  const scoreColor =
    match.matchScore >= 90
      ? "text-green-400 border-green-400/30 bg-green-400/5"
      : match.matchScore >= 75
        ? "text-accent border-accent/30 bg-accent/5"
        : "text-amber-400 border-amber-400/30 bg-amber-400/5";

  return (
    <div
      className={`border rounded-2xl overflow-hidden transition-all duration-200
      ${rank === 0 ? "border-accent/40" : "border-border"}`}
    >
      {/* Card header */}
      <div
        className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-elevated/40 transition-colors
          ${rank === 0 ? "bg-accent/5" : ""}`}
        onClick={() => setOpen(!open)}
      >
        {/* Rank badge */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold
          ${rank === 0 ? "bg-accent text-void" : "bg-elevated text-subtle"}`}
        >
          {rank + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-txt">{match.name}</p>
            {rank === 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30 font-medium">
                Best Match
              </span>
            )}
          </div>
          <p className="text-xs text-subtle mt-0.5 truncate">{match.bestFor}</p>
          {/* Source badge — ye naya add hua */}
          <div className="flex items-center gap-1.5 mt-1">
            {match.specs?.source === "web" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                📡 Web
              </span>
            )}
            {match.specs?.source === "database" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">
                📦 DB
              </span>
            )}
          </div>
        </div>

        {/* Score */}
        <div
          className={`flex-shrink-0 text-center border rounded-xl px-3 py-1.5 ${scoreColor}`}
        >
          <p className="text-lg font-bold leading-none">{match.matchScore}</p>
          <p className="text-xs opacity-70">match</p>
        </div>

        <span className="text-muted flex-shrink-0">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Verdict */}
          <p className="text-sm text-subtle leading-relaxed">{match.verdict}</p>

          {/* Pros / Cons */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted font-medium mb-2 uppercase tracking-wide">
                Pros
              </p>
              <div className="space-y-1.5">
                {(match.pros || []).map((p, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <CheckCircle
                      size={11}
                      className="text-green-400 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-xs text-subtle">{p}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted font-medium mb-2 uppercase tracking-wide">
                Cons
              </p>
              <div className="space-y-1.5">
                {(match.cons || []).map((c, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <XCircle
                      size={11}
                      className="text-red-400/70 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-xs text-subtle">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Key specs strip */}
          {match.specs && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Battery", value: match.specs.battery },
                { label: "RAM", value: match.specs.ram },
                { label: "CPU", value: match.specs.cpu },
                { label: "Camera", value: match.specs.camera },
                { label: "Charging", value: match.specs.charging },
                { label: "Display", value: match.specs.display },
              ].map(({ label, value }) =>
                value ? (
                  <div key={label} className="bg-elevated rounded-xl px-3 py-2">
                    <p className="text-xs text-muted">{label}</p>
                    <p className="text-xs text-txt font-medium mt-0.5 leading-tight">
                      {value}
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PhoneMatchmaker() {
  const [lifestyle, setLifestyle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const find = async () => {
    if (lifestyle.trim().length < 10) {
      toast.error("Thoda aur describe karo apni usage");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/user/matchmaker", { lifestyle });
      setResult(data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Matchmaker failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-shrink-0">
        <Sparkles size={13} className="text-accent" />
        <span className="text-sm font-display font-semibold">
          Phone DNA Matchmaker
        </span>
        <span className="badge-accent text-xs ml-auto">AI</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {/* Input section */}
        <div className="space-y-3">
          <div>
            <p className="text-xs text-subtle mb-1 leading-relaxed">
              Apni phone usage describe karo — AI tumhari lifestyle samjhega aur
              perfect match dhundega
            </p>
          </div>

          <textarea
            value={lifestyle}
            onChange={(e) => setLifestyle(e.target.value)}
            placeholder="Meri phone hamesha battery mein khatam ho jaati hai, main bahut photos leta hoon aur YouTube dekhta hoon..."
            rows={4}
            className="input-field w-full resize-none text-sm leading-relaxed"
            disabled={loading}
          />

          {/* Example chips */}
          {!result && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Examples:</p>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setLifestyle(ex)}
                  className="w-full text-left text-xs text-subtle px-3 py-2 rounded-xl
                    bg-elevated border border-border hover:border-accent/30
                    hover:text-txt transition-all duration-200 leading-relaxed"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          )}

          <button
            onClick={find}
            disabled={loading || lifestyle.trim().length < 10}
            className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Analyzing your
                lifestyle…
              </>
            ) : (
              <>
                <Sparkles size={14} /> Find My Perfect Phone
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Extracted needs */}
            {result.extracted?.summary && (
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={11} className="text-accent" />
                  <span className="text-xs font-medium text-accent">
                    AI Analysis
                  </span>
                </div>
                <p className="text-xs text-subtle leading-relaxed">
                  {result.extracted.summary}
                </p>
                {result.extracted.priorities?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {result.extracted.priorities.map((p) => (
                      <span
                        key={p}
                        className="text-xs px-2 py-0.5 rounded-full bg-elevated border border-border text-muted capitalize"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {result.usedWeb && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-xl px-3 py-2">
                <span>📡</span>
                <span>
                  Some results fetched from web, so they may not be 100%
                  accurate.
                </span>
              </div>
            )}

            {/* Match cards */}
            {result.matches?.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted font-medium uppercase tracking-wide flex items-center gap-1">
                  <Star size={10} /> Top Matches for You
                </p>
                {result.matches.map((match, i) => (
                  <MatchCard key={match.id || i} match={match} rank={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-subtle text-sm">
                  Koi match nahi mila — thoda aur specific likho
                </p>
              </div>
            )}

            {/* Try again */}
            <button
              onClick={() => {
                setResult(null);
                setLifestyle("");
              }}
              className="w-full py-2 text-xs text-muted border border-border rounded-xl hover:border-accent/30 hover:text-subtle transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
