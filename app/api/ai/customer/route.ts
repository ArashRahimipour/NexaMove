import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai/client";
import { CUSTOMER_TOOLS } from "@/lib/ai/customerTools";
import { customerSystemPrompt } from "@/lib/ai/prompts";
import { runChatWithTools } from "@/lib/ai/chat";
import { writeAiActivityLog } from "@/lib/ai/audit";
import { checkRateLimit, CUSTOMER_AI_RATE_LIMIT } from "@/lib/ai/rateLimit";

const bodySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(1000),
  // Public tracking page identifies the delivery by its tracking code —
  // never a raw database ID — so a guess can't leak an unrelated delivery.
  trackingCode: z.string().optional(),
  // Retail-client portal identifies by delivery ID, but only after we
  // verify below that it belongs to the caller's own organisation.
  deliveryId: z.string().optional(),
});

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI Assistant is temporarily unavailable. Core NexaMove operations are still available." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { message, trackingCode, deliveryId: requestedDeliveryId } = parsed.data;

  let deliveryId: string | null = null;
  let rateLimitKey: { userId?: string; ipAddress?: string };

  if (trackingCode) {
    const delivery = await prisma.delivery.findUnique({ where: { trackingCode }, select: { id: true } });
    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    deliveryId = delivery.id;
    rateLimitKey = { ipAddress: clientIp(req) };
  } else if (requestedDeliveryId) {
    const session = await auth();
    if (!session || session.user.role !== "RETAIL_CLIENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const delivery = await prisma.delivery.findUnique({
      where: { id: requestedDeliveryId },
      select: { id: true, organisationId: true },
    });
    if (!delivery || delivery.organisationId !== session.user.organisationId) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }
    deliveryId = delivery.id;
    rateLimitKey = { userId: session.user.id };
  } else {
    return NextResponse.json({ error: "Missing trackingCode or deliveryId" }, { status: 400 });
  }

  const rate = await checkRateLimit({ key: rateLimitKey, ...CUSTOMER_AI_RATE_LIMIT });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many messages — please try again in a few minutes, or contact customer service." }, { status: 429 });
  }

  let conversation = parsed.data.conversationId
    ? await prisma.aiConversation.findFirst({
        where: { id: parsed.data.conversationId, deliveryId, kind: "CUSTOMER" },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.aiConversation.create({ data: { kind: "CUSTOMER", deliveryId } });
  }

  const priorMessages = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 12,
  });

  await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: "USER", content: message } });

  let result;
  let errorMessage: string | null = null;
  try {
    result = await runChatWithTools({
      systemPrompt: customerSystemPrompt(),
      history: [
        ...priorMessages.map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content })),
        { role: "user", content: message },
      ],
      tools: CUSTOMER_TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
      executeTool: async (name, args) => {
        const tool = CUSTOMER_TOOLS.find((t) => t.name === name);
        if (!tool) return { error: "Tool not permitted" };
        return tool.handler(args, { deliveryId: deliveryId! });
      },
    });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "AI request failed";
  }

  if (!result) {
    await writeAiActivityLog({
      conversationId: conversation.id,
      ipAddress: rateLimitKey.ipAddress,
      userRequest: message,
      action: "customer_chat",
      errorMessage,
    });
    return NextResponse.json(
      { error: "AI Assistant is temporarily unavailable. Please contact customer service for help with this delivery." },
      { status: 503 }
    );
  }

  await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: "ASSISTANT", content: result.reply } });

  await writeAiActivityLog({
    conversationId: conversation.id,
    ipAddress: rateLimitKey.ipAddress,
    userId: rateLimitKey.userId,
    userRequest: message,
    action: "customer_chat",
    toolsCalled: result.toolsCalled.map((t) => t.name),
    readOnly: !result.toolsCalled.some((t) => t.name.startsWith("create_")),
    resultSummary: result.reply.slice(0, 500),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    tokensUsed: result.tokensUsed,
    affectedRecordIds: deliveryId ? [deliveryId] : undefined,
  });

  return NextResponse.json({ conversationId: conversation.id, reply: result.reply });
}
