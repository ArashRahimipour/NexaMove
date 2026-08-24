import { prisma } from "@/lib/prisma";

// DB-backed (not in-memory) so limits hold across serverless cold starts.
// Counts recent ai_activity_log rows for the given key rather than needing
// Redis or another stateful service.
export async function checkRateLimit(params: {
  key: { userId?: string; ipAddress?: string };
  windowMinutes: number;
  maxRequests: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const since = new Date(Date.now() - params.windowMinutes * 60_000);
  const where = params.key.userId
    ? { userId: params.key.userId, createdAt: { gte: since } }
    : { ipAddress: params.key.ipAddress, createdAt: { gte: since } };

  const count = await prisma.aiActivityLog.count({ where });
  return {
    allowed: count < params.maxRequests,
    remaining: Math.max(0, params.maxRequests - count),
  };
}

// Public/customer-facing limits are tighter than authenticated internal-staff limits.
export const CUSTOMER_AI_RATE_LIMIT = { windowMinutes: 10, maxRequests: 20 };
export const OPERATIONS_AI_RATE_LIMIT = { windowMinutes: 10, maxRequests: 60 };
