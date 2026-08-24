import { prisma } from "@/lib/prisma";

interface AuditParams {
  userId?: string | null;
  action: string;
  recordType: string;
  recordId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}

// Append-only audit trail. Never update or delete existing rows — corrections
// happen by writing a new event, same as the tracking-event log for deliveries.
export async function writeAuditLog(params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? undefined,
      action: params.action,
      recordType: params.recordType,
      recordId: params.recordId ?? undefined,
      beforeValue: params.before !== undefined ? JSON.stringify(params.before) : undefined,
      afterValue: params.after !== undefined ? JSON.stringify(params.after) : undefined,
      ipAddress: params.ipAddress ?? undefined,
    },
  });
}
