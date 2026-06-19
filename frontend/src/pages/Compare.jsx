import { useState, useCallback } from "react";
import { GitCompare, Search, Loader2, Trophy, Zap, X } from "lucide-react";
import api from "../api/client.js";
import toast from "react-hot-toast";

function renderAnalysis(text) {
  const lines = text.split("\n");
  let html = "";
  let inTable = false;
  let tableHtml = "";
  let isFirstRow = true;

  for (const line of lines) {
    const trimmed = line.trim();

    // Table row detect
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Separator row skip karo
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue;

      const cells = trimmed
        .split("|")
        .filter((_, i, arr) => i !== 0 && i !== arr.length - 1)
        .map((c) => c.trim());

      if (!inTable) {
        inTable = true;
        isFirstRow = true;
        tableHtml = `<div class="overflow-x-auto my-4"><table class="w-full text-xs border-collapse rounded-xl overflow-hidden">`;
      }

      if (isFirstRow) {
        tableHtml += `<thead class="bg-elevated"><tr>`;
        cells.forEach((c) => {
          tableHtml += `<th class="px-3 py-2.5 text-left text-accent font-semibold border-b border-accent/20">${c}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;
        isFirstRow = false;
      } else {
        tableHtml += `<tr class="border-b border-border hover:bg-elevated/50 transition-colors">`;
        cells.forEach((c) => {
          tableHtml += `<td class="px-3 py-2 text-subtle">${c}</td>`;
        });
        tableHtml += `</tr>`;
      }
    } else {
      // Table end
      if (inTable) {
        tableHtml += `</tbody></table></div>`;
        html += tableHtml;
        tableHtml = "";
        inTable = false;
        isFirstRow = true;
      }

      // Normal markdown
      let processed = trimmed
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(
          /`([^`]+)`/g,
          "<code class='bg-elevated px-1 rounded text-accent'>$1</code>",
        );

      if (/^### (.+)/.test(processed))
        processed = processed.replace(
          /^### (.+)/,
          "<h3 class='font-semibold text-sm mt-4 mb-2 text-txt'>$1</h3>",
        );
      else if (/^## (.+)/.test(processed))
        processed = processed.replace(
          /^## (.+)/,
          "<h2 class='font-bold text-base mt-4 mb-2 text-txt'>$1</h2>",
        );
      else if (/^# (.+)/.test(processed))
        processed = processed.replace(
          /^# (.+)/,
          "<h1 class='font-bold text-lg mt-4 mb-2 text-txt'>$1</h1>",
        );
      else if (/^[-*] (.+)/.test(processed))
        processed = processed.replace(
          /^[-*] (.+)/,
          "<li class='ml-4 list-disc text-subtle mb-1'>$1</li>",
        );
      else if (processed)
        processed = `<p class='mb-2 text-subtle'>${processed}</p>`;

      html += processed + "\n";
    }
  }

  // Table agar end mein ho
  if (inTable) {
    tableHtml += `</tbody></table></div>`;
    html += tableHtml;
  }

  return html;
}

function SearchBox({ label, selected, onSelect, onClear }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (val) => {
    setQ(val);
    if (!val.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(
        `/user/phones/search?q=${encodeURIComponent(val)}&page=1`,
      );
      setResults(data.phones.slice(0, 8));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const pick = (phone) => {
    onSelect(phone);
    setQ("");
    setResults([]);
  };

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs text-subtle font-body mb-2">{label}</p>
      {selected ? (
        <div className="card flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-subtle">{selected.brand}</p>
            <p className="font-display font-semibold text-txt truncate">
              {selected.model}
            </p>
            {selected.year && (
              <p className="text-xs text-muted font-mono">{selected.year}</p>
            )}
          </div>
          <button
            onClick={onClear}
            className="text-muted hover:text-subtle transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Search phone name…"
            className="input-field pl-9"
          />
          {loading && (
            <Loader2
              size={13}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin"
            />
          )}
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-elevated border border-border rounded-xl overflow-hidden z-10 shadow-xl">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left border-b border-border last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-subtle">{p.brand}</p>
                    <p className="text-sm text-txt font-display font-medium truncate">
                      {p.model}
                    </p>
                  </div>
                  {p.year && (
                    <span className="text-xs text-muted font-mono flex-shrink-0">
                      {p.year}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpecRow({ label, a, b }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2.5 px-4 text-xs text-muted font-mono w-36 flex-shrink-0">
        {label}
      </td>
      <td className="py-2.5 px-4 text-sm text-txt">
        {a || <span className="text-muted">—</span>}
      </td>
      <td className="py-2.5 px-4 text-sm text-txt">
        {b || <span className="text-muted">—</span>}
      </td>
    </tr>
  );
}

const SPEC_LABELS = [
  ["Released", "released"],
  ["OS", "os"],
  ["RAM", "ram"],
  ["Storage", "storage"],
  ["Display", "display"],
  ["Camera", "camera"],
  ["Battery", "battery"],
  ["Charging", "charging"],
  ["Dimensions", "dimensions"],
  ["Weight", "weight"],
  ["NFC", "nfc"],
];

export default function Compare() {
  const [phoneA, setPhoneA] = useState(null);
  const [phoneB, setPhoneB] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (!phoneA || !phoneB) return toast.error("Select two phones first");
    if (phoneA.id === phoneB.id)
      return toast.error("Select two different phones");
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/chat/compare", {
        phoneA: phoneA.model,
        phoneB: phoneB.model,
      });
      setResult(data.response);
    } catch (err) {
      toast.error(err.response?.data?.error || "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPhoneA(null);
    setPhoneB(null);
    setResult(null);
  };

  return (
    <main className="min-h-screen bg-void pt-16">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/4 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <GitCompare size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl">Phone Compare</h1>
            <p className="text-subtle text-sm">
              Side-by-side specs + AI analysis
            </p>
          </div>
        </div>

        {/* Selectors */}
        <div className="card mb-6">
          <div className="flex items-end gap-4">
            <SearchBox
              label="Phone A"
              selected={phoneA}
              onSelect={setPhoneA}
              onClear={() => {
                setPhoneA(null);
                setResult(null);
              }}
            />
            <div className="flex-shrink-0 pb-1">
              <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center">
                <GitCompare size={13} className="text-muted" />
              </div>
            </div>
            <SearchBox
              label="Phone B"
              selected={phoneB}
              onSelect={setPhoneB}
              onClear={() => {
                setPhoneB(null);
                setResult(null);
              }}
            />
          </div>
          <div className="flex gap-3 mt-4 pt-4 border-t border-border">
            <button
              onClick={handleCompare}
              disabled={!phoneA || !phoneB || loading}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Compare now
                </>
              )}
            </button>
            {result && (
              <button onClick={reset} className="btn-ghost">
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Spec table */}
        {result?.phoneA && result?.phoneB && (
          <div className="card mb-6 overflow-hidden p-0">
            <div className="grid grid-cols-3 bg-elevated border-b border-border">
              <div className="p-4 text-xs text-muted font-mono">Spec</div>
              <div className="p-4 border-l border-border">
                <p className="text-xs text-subtle">
                  {result.phoneA?.name?.split(" ")[0]}
                </p>
                <p className="font-display font-semibold text-txt text-sm">
                  {result.phoneA?.name?.split(" ").slice(1).join(" ")}
                </p>
              </div>
              <div className="p-4 border-l border-border">
                <p className="text-xs text-subtle">
                  {result.phoneB?.name?.split(" ")[0]}
                </p>
                <p className="font-display font-semibold text-txt text-sm">
                  {result.phoneB?.name?.split(" ").slice(1).join(" ")}
                </p>
              </div>
            </div>
            <table className="w-full">
              <tbody>
                {SPEC_LABELS.map(([label, key]) => (
                  <SpecRow
                    key={key}
                    label={label}
                    a={result.phoneA?.[key]}
                    b={result.phoneB?.[key]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* AI Analysis */}
        {loading && (
          <div className="card flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
              <Loader2 size={18} className="text-accent animate-spin" />
            </div>
            <div>
              <p className="font-display font-semibold">Analyzing specs…</p>
              <p className="text-subtle text-sm">
                Comparing {phoneA?.model} vs {phoneB?.model}
              </p>
            </div>
          </div>
        )}

        {result?.analysis && (
          <div className="card animate-fade-up">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
              <Trophy size={16} className="text-accent" />
              <h2 className="font-display font-semibold">AI Analysis</h2>
              <span className="badge-accent ml-auto">Llama 3.3 70B</span>
            </div>
            <div
              className="prose-ai text-sm leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: renderAnalysis(result.analysis),
              }}
            />
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div className="text-center py-16">
            <GitCompare size={40} className="text-border mx-auto mb-4" />
            <h3 className="font-display font-semibold text-txt mb-2">
              Select two phones to compare
            </h3>
            <p className="text-subtle text-sm max-w-sm mx-auto">
              Search and pick any two phones above. You'll get a full spec table
              plus AI-powered analysis.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
