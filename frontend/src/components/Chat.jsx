import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Send, Trash2, Bot, User, Loader2, Sparkles, Zap } from "lucide-react";
import api from "../api/client.js";
import toast from "react-hot-toast";

const SUGGESTIONS = [
  "What's the best flagship phone in 2023?",
  "Compare battery life iPhone 14 vs Pixel 8",
  "Best budget 5G phone under $300",
  "Which phone has the best ultrawide camera?",
];

// FIX #8: Rewrote renderMarkdown to fix two bugs in the original:
//
// Bug 1 — The <ul> regex used a greedy `.*` with the `s` flag, which captured ALL
// <li> tags in the entire response in one match, collapsing every list into one <ul>.
// Fix: match runs of consecutive <li> lines using a non-greedy repeated group.
//
// Bug 2 — The final `.replace(/^(?!<[hul])/gm, "")` stripped the start of every
// line that didn't begin with a tag, silently deleting plain-text paragraphs.
// Fix: removed that broken line entirely.
function renderMarkdown(text) {
  // Tables
  text = text.replace(/^\|(.+)\|$/gm, (line) => {
    const cells = line.split("|").filter((c) => c.trim() !== "");
    return `<tr>${cells.map((c) => `<td>${c.trim()}</td>`).join("")}</tr>`;
  });

  // Separator rows hata do (| --- | --- |)
  text = text.replace(/<tr>(<td>[-: ]+<\/td>)+<\/tr>/g, "");

  // Pehli tr ko thead banao
  text = text.replace(/(<tr>.*?<\/tr>)/, "<thead>$1</thead>");

  // Baaki rows tbody mein
  text = text.replace(/((?:<tr>.*?<\/tr>\n?)+)$/m, (match, p1) => {
    if (p1.includes("<thead>")) return p1;
    return `<tbody>${p1}</tbody>`;
  });

  // Table wrap
  text = text.replace(/((?:<(?:thead|tbody|tr)>.*?<\/(?:thead|tbody|tr)>\n?)+)/gs,
    '<div class="overflow-x-auto my-3"><table class="w-full text-xs border-collapse">$1</table></div>'
  );

  // Bold, italic, code
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
  text = text.replace(/`([^`]+)`/g, "<code class='bg-elevated px-1 rounded text-accent'>$1</code>");

  // Headings
  text = text.replace(/^### (.+)$/gm, "<h3 class='text-sm font-semibold mt-3 mb-1'>$1</h3>");
  text = text.replace(/^## (.+)$/gm,  "<h2 class='text-sm font-bold mt-3 mb-1'>$2</h2>");
  text = text.replace(/^# (.+)$/gm,   "<h1 class='text-base font-bold mt-3 mb-1'>$1</h1>");

  // Lists
  text = text.replace(/^- (.+)$/gm, "<li class='ml-3 list-disc'>$1</li>");
  text = text.replace(/(<li.*<\/li>\n?)+/g, "<ul class='my-2 space-y-1'>$&</ul>");

  // Paragraphs
  text = text.replace(/\n{2,}/g, "</p><p class='mb-2'>");

  return text;
}

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 animate-fade-up ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
        ${isUser ? "bg-accent/20 border border-accent/30" : "bg-elevated border border-border"}`}>
        {isUser ? <User size={12} className="text-accent" /> : <Bot size={12} className="text-subtle" />}
      </div>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${isUser
          ? "bg-accent/12 border border-accent/20 text-txt rounded-tr-sm"
          : "bg-elevated border border-border text-txt rounded-tl-sm"
        } ${msg.loading ? "typing-cursor" : ""}`}>
        {msg.loading
          ? <span className="text-subtle text-xs">Thinking…</span>
          : isUser
            ? <span>{msg.content}</span>
            : <div className="prose-ai" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
        }
        {!msg.loading && !isUser && msg.cached && (
          <div className="mt-2 flex items-center gap-1">
            <Zap size={10} className="text-accent" />
            <span className="text-xs text-accent/70 font-mono">cached</span>
          </div>
        )}
      </div>
    </div>
  );
}

const Chat = forwardRef(function Chat({ onNewMessage }, ref) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [resumed, setResumed]   = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useImperativeHandle(ref, () => ({
    loadConversation(historyItem) {
      setMessages([
        { id: "h-user", role: "user",      content: historyItem.message },
        { id: "h-ai",   role: "assistant", content: historyItem.response, cached: historyItem.cached },
      ]);
      setResumed(true);
      setTimeout(() => inputRef.current?.focus(), 100);
      toast.success("Conversation Resumed");
    },
  }));

  const send = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    setResumed(false);

    const userMsg = { id: Date.now(),     role: "user",      content };
    const loadMsg = { id: Date.now() + 1, role: "assistant", content: "", loading: true };
    setMessages((prev) => [...prev, userMsg, loadMsg]);

    const historyForAPI = messages
      .filter((m) => !m.loading)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data } = await api.post("/chat", {
        message: content,
        history: historyForAPI,
      });
      setMessages((prev) =>
        prev.map((m) => m.loading
          ? { ...m, content: data.response, cached: data.cached, loading: false }
          : m
        )
      );
      onNewMessage?.();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !m.loading));
      toast.error(err.response?.data?.error || "Request failed");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, messages, onNewMessage]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse-slow" />
          <span className="text-sm font-display font-semibold">AI Chat</span>
          <span className="badge-accent text-xs">Llama 3.3 70B</span>
          {resumed && (
            <span className="text-xs text-amber-400 border border-amber-400/30 rounded-full px-2 py-0.5">
              ↩ resumed
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); setResumed(false); }}
            className="text-muted hover:text-subtle transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
              <Sparkles size={22} className="text-accent" />
            </div>
            <h3 className="font-display font-semibold mb-1.5">Ask about any phone</h3>
            <p className="text-subtle text-sm max-w-xs mb-6 leading-relaxed">
              Compare specs, get buying advice, or find the perfect device for your needs.
            </p>
            <div className="space-y-2 w-full max-w-xs">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="w-full text-left text-xs text-subtle font-mono px-3 py-2.5
                  rounded-xl bg-elevated border border-border hover:border-accent/40
                  hover:text-txt transition-all duration-200">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : messages.map((m) => <Bubble key={m.id} msg={m} />)}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          <input ref={inputRef} type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={resumed ? "Aage poochho…" : "Ask about any phone…"}
            className="input-field flex-1" disabled={sending} />
          <button onClick={() => send()} disabled={!input.trim() || sending}
            className="btn-primary px-3 flex items-center justify-center">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
});

export default Chat;
