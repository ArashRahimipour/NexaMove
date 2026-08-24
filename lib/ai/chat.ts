import type OpenAI from "openai";
import { getOpenAiClient, AI_MODEL } from "@/lib/ai/client";

export interface ChatToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatTurnResult {
  reply: string;
  toolsCalled: { name: string; args: unknown }[];
  tokensUsed: number | null;
}

const MAX_TOOL_ITERATIONS = 5;
const MAX_HISTORY_MESSAGES = 20;

// Shared OpenAI function-calling loop used by both the Operations AI and
// Customer AI — the only thing that differs between them is the system
// prompt, the tool list, and the tool executor closure (which enforces each
// surface's own data-scoping rules).
export async function runChatWithTools(params: {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  tools: ChatToolDef[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}): Promise<ChatTurnResult> {
  const client = getOpenAiClient();

  const openAiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = params.tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: params.systemPrompt },
    ...params.history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
  ];

  const toolsCalled: { name: string; args: unknown }[] = [];
  let totalTokens = 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages,
      tools: openAiTools.length > 0 ? openAiTools : undefined,
      temperature: 0.2,
    });

    totalTokens += completion.usage?.total_tokens ?? 0;
    const choice = completion.choices[0];
    const message = choice.message;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { reply: message.content ?? "", toolsCalled, tokensUsed: totalTokens || null };
    }

    messages.push(message);

    for (const call of message.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        // malformed args from the model — treat as empty rather than crash the turn
      }
      toolsCalled.push({ name: call.function.name, args });

      let result: unknown;
      try {
        result = await params.executeTool(call.function.name, args);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "Tool execution failed" };
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 8000),
      });
    }
  }

  return {
    reply: "I looked into this but need a narrower question to give you a reliable answer — could you rephrase?",
    toolsCalled,
    tokensUsed: totalTokens || null,
  };
}
