"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AiChatPanel({
  endpoint,
  extraBody,
  suggestions,
  placeholder,
  greeting,
}: {
  endpoint: string;
  extraBody?: Record<string, unknown>;
  suggestions?: string[];
  placeholder?: string;
  greeting?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput("");
    setUnavailable(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId, ...extraBody }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 503) {
        setUnavailable(json.error ?? "AI Assistant is temporarily unavailable.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: json.error ?? "Something went wrong — please try again." }]);
        setLoading(false);
        return;
      }

      setConversationId(json.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error — please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex h-full min-h-[420px] flex-col gap-3 border-brand-500/15 p-0">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex items-start gap-2 rounded-[10px] bg-elevated p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
            <p className="text-sm text-secondary">{greeting ?? "Hi, how can I help?"}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-[10px] px-3 py-2 text-sm ${
                m.role === "user" ? "bg-brand-500/15 text-ink" : "bg-elevated text-secondary"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-brand-400" /> Thinking…
          </div>
        )}
        {unavailable && (
          <div className="rounded-[10px] border border-line bg-elevated p-3 text-sm text-dim">{unavailable}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {suggestions && suggestions.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-4">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-line bg-elevated px-3 py-1.5 text-xs text-secondary transition-colors hover:border-brand-500/40 hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-line p-3"
      >
        <input
          className="field-input"
          placeholder={placeholder ?? "Ask a question…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn-primary px-3" disabled={loading || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
