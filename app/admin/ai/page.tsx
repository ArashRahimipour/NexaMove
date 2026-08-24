import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Info, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { canUseOperationsAi } from "@/lib/ai/operationsTools";
import { computeOpsSummary } from "@/lib/ai/opsSummary";
import { isAiConfigured } from "@/lib/ai/client";
import { AiChatPanel } from "@/components/AiChatPanel";

const SUGGESTIONS = [
  "Give me today's operational summary.",
  "What needs my attention right now?",
  "Show me deliveries delayed by more than 30 minutes.",
  "Which customers need an update?",
  "Compare this week's delivery performance with last week.",
  "Show anything expiring within 30 days.",
  "Summarise this month's damage incidents.",
];

export default async function OperationsAiPage() {
  const session = await auth();
  if (!session || !canUseOperationsAi(session.user.role)) redirect("/login");

  const summary = await computeOpsSummary();
  const aiReady = isAiConfigured();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-[10px] bg-brand-500/10 p-2 text-brand-400 shadow-glow">
          <Sparkles className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold">NexaMove AI Operations Centre</h1>
      </div>

      {!aiReady && (
        <div className="card border-warn/30 bg-elevated text-sm text-dim">
          AI Assistant is temporarily unavailable — an <code className="text-secondary">OPENAI_API_KEY</code> hasn&apos;t
          been configured yet. Everything below the chat still reflects real, live NexaMove data.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <p className="text-sm text-dim">Today&apos;s operations</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-2xl font-bold text-ink">{summary.scheduled}</p>
              <p className="text-xs text-dim">scheduled</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-ok">{summary.completed}</p>
              <p className="text-xs text-dim">completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-400">{summary.inTransit}</p>
              <p className="text-xs text-dim">in transit</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-danger">{summary.failed}</p>
              <p className="text-xs text-dim">failed today</p>
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2 space-y-3">
          <p className="text-sm font-semibold text-ink">Priorities</p>
          {summary.critical.length === 0 && summary.attention.length === 0 && (
            <p className="text-sm text-dim">Nothing needs urgent attention right now.</p>
          )}
          {summary.critical.map((item, i) => (
            <div key={`c-${i}`} className="flex items-start gap-2 border-l-4 border-l-danger pl-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{item.label}</p>
                <p className="text-xs text-dim">{item.detail}</p>
              </div>
              {item.href && (
                <Link href={item.href} className="ml-auto shrink-0 text-xs text-brand-400 hover:underline">
                  View →
                </Link>
              )}
            </div>
          ))}
          {summary.attention.map((item, i) => (
            <div key={`a-${i}`} className="flex items-start gap-2 border-l-4 border-l-warn pl-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{item.label}</p>
                <p className="text-xs text-dim">{item.detail}</p>
              </div>
              {item.href && (
                <Link href={item.href} className="ml-auto shrink-0 text-xs text-brand-400 hover:underline">
                  View →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="h-[560px]">
        <AiChatPanel
          endpoint="/api/ai/operations"
          suggestions={SUGGESTIONS}
          placeholder="Ask NexaMove AI…"
          greeting="Hi, I can answer questions about today's operations using real NexaMove data — try one of the suggestions below or ask your own."
        />
      </div>
    </div>
  );
}
