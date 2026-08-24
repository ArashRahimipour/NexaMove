import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const organisationId = searchParams.get("organisationId");

  const approvals = await prisma.clientDriverApproval.findMany({
    where: organisationId ? { organisationId } : {},
    include: { driver: { select: { id: true, name: true } }, organisation: { select: { companyName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ approvals });
}

const upsertSchema = z.object({
  organisationId: z.string().min(1),
  driverId: z.string().min(1),
  approved: z.boolean().default(false),
  dedicated: z.boolean().default(false),
  primaryDriver: z.boolean().default(false),
  complianceStatus: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Upsert on (organisationId, driverId) — one approval record per
// client/driver pair, edited in place rather than accumulating history
// (unlike PreDeliveryConfirmation/DispatchScan, this is current state, not
// an event log — changes are still captured by the audit log below).
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const approval = await prisma.clientDriverApproval.upsert({
    where: { organisationId_driverId: { organisationId: data.organisationId, driverId: data.driverId } },
    update: data,
    create: data,
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "client_driver_approval.upserted",
    recordType: "ClientDriverApproval",
    recordId: approval.id,
    after: data,
  });

  return NextResponse.json({ approval });
}
