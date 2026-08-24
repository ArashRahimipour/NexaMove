"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { AiChatPanel } from "@/components/AiChatPanel";

const SUGGESTIONS = ["Where is my delivery?", "When will it arrive?", "Has my driver started the route?", "I want to report damaged furniture."];

export function CustomerAiWidget({ trackingCode }: { trackingCode: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-primary mt-4 w-full gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Ask NexaMove Delivery Assistant
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Sparkles className="h-4 w-4 text-brand-400" /> NexaMove Delivery Assistant
        </p>
        <button onClick={() => setOpen(false)} className="text-dim hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-[420px]">
        <AiChatPanel
          endpoint="/api/ai/customer"
          extraBody={{ trackingCode }}
          suggestions={SUGGESTIONS}
          placeholder="Ask about your delivery…"
          greeting="Hi, I can help with your delivery. What would you like to know?"
        />
      </div>
    </div>
  );
}
