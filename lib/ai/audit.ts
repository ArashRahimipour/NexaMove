import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

interface AiAuditParams {
  conversationId?: string | null;
  userId?: string | null;
  role?: Role | null;
  organisationId?: string | null;
  ipAddress?: string | null;
  userRequest?: string | null;
  action: string;
  toolsCalled?: string[];
  affectedRecordIds?: string[];
  readOnly?: boolean;
  humanConfirmationRequired?: boolean;
  resultSummary?: string | null;
  model?: string | null;
  tokensUsed?: number | null;
  errorMessage?: string | null;
}

// Append-only — mirrors lib/audit.ts's writeAuditLog but for AI activity
// specifically, so AI usage can be reviewed and rate-limited independently.
// Never pass hidden chain-of-thought here, only the user's request, a short
// result summary, and tool-call metadata.
export async function writeAiActivityLog(params: AiAuditParams) {
  await prisma.aiActivityLog.create({
    data: {
      conversationId: params.conversationId ?? undefined,
      userId: params.userId ?? undefined,
      role: params.role ?? undefined,
      organisationId: params.organisationId ?? undefined,
      ipAddress: params.ipAddress ?? undefined,
      userRequest: params.userRequest?.slice(0, 2000) ?? undefined,
      action: params.action,
      toolsCalled: params.toolsCalled ? JSON.stringify(params.toolsCalled) : undefined,
      affectedRecordIds: params.affectedRecordIds ? JSON.stringify(params.affectedRecordIds) : undefined,
      readOnly: params.readOnly ?? true,
      humanConfirmationRequired: params.humanConfirmationRequired ?? false,
      resultSummary: params.resultSummary?.slice(0, 2000) ?? undefined,
      model: params.model ?? undefined,
      tokensUsed: params.tokensUsed ?? undefined,
      errorMessage: params.errorMessage?.slice(0, 2000) ?? undefined,
    },
  });
}
