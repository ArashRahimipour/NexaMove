import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai/client";
import { toolsForRole, canUseOperationsAi } from "@/lib/ai/operationsTools";
import { OPERATIONS_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { runChatWithTools } from "@/lib/ai/chat";
import { writeAiActivityLog } from "@/lib/ai/audit";
import { checkRateLimit, OPERATIONS_AI_RATE_LIMIT } from "@/lib/ai/rateLimit";

const bodySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !canUseOperationsAi(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI Assistant is temporarily unavailable. Core NexaMove operations are still available." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { message } = parsed.data;

  const rate = await checkRateLimit({ key: { userId: session.user.id }, ...OPERATIONS_AI_RATE_LIMIT });
  if (!rate.allowed) {
    return NextResponse.json({ error: "You've reached the AI usage limit for now — try again shortly." }, { status: 429 });
  }

  let conversation = parsed.data.conversationId
    ? await prisma.aiConversation.findFirst({
        where: { id: parsed.data.conversationId, userId: session.user.id, kind: "OPERATIONS" },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.aiConversation.create({
      data: { kind: "OPERATIONS", userId: session.user.id, title: message.slice(0, 80) },
    });
  }

  const priorMessages = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  await prisma.aiMessage.create({
    data: { conversationId: conversation.id, role: "USER", content: message },
  });

  const tools = toolsForRole(session.user.role);
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  let result;
  let errorMessage: string | null = null;
  try {
    result = await runChatWithTools({
      systemPrompt: OPERATIONS_SYSTEM_PROMPT,
      history: [
        ...priorMessages.map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content })),
        { role: "user", content: message },
      ],
      tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
      executeTool: async (name, args) => {
        const tool = toolMap.get(name);
        if (!tool) return { error: "Tool not permitted for this role" };
        return tool.handler(args, { role: session.user.role, userId: session.user.id });
      },
    });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "AI request failed";
  }

  if (!result) {
    await writeAiActivityLog({
      conversationId: conversation.id,
      userId: session.user.id,
      role: session.user.role,
      userRequest: message,
      action: "operations_chat",
      errorMessage,
    });
    return NextResponse.json(
      { error: "AI Assistant is temporarily unavailable. Core NexaMove operations are still available." },
      { status: 503 }
    );
  }

  await prisma.aiMessage.create({
    data: { conversationId: conversation.id, role: "ASSISTANT", content: result.reply },
  });

  await writeAiActivityLog({
    conversationId: conversation.id,
    userId: session.user.id,
    role: session.user.role,
    userRequest: message,
    action: "operations_chat",
    toolsCalled: result.toolsCalled.map((t) => t.name),
    readOnly: !result.toolsCalled.some((t) => t.name.startsWith("create_")),
    resultSummary: result.reply.slice(0, 500),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    tokensUsed: result.tokensUsed,
  });

  return NextResponse.json({ conversationId: conversation.id, reply: result.reply });
}
