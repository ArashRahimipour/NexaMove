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

  const approvals = await prisma.clientVehicleApproval.findMany({
    where: organisationId ? { organisationId } : {},
    include: { vehicle: { select: { id: true, registration: true } }, organisation: { select: { companyName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ approvals });
}

const upsertSchema = z.object({
  organisationId: z.string().min(1),
  vehicleId: z.string().min(1),
  approved: z.boolean().default(false),
  dedicated: z.boolean().default(false),
  preferred: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const approval = await prisma.clientVehicleApproval.upsert({
    where: { organisationId_vehicleId: { organisationId: data.organisationId, vehicleId: data.vehicleId } },
    update: data,
    create: data,
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "client_vehicle_approval.upserted",
    recordType: "ClientVehicleApproval",
    recordId: approval.id,
    after: data,
  });

  return NextResponse.json({ approval });
}
