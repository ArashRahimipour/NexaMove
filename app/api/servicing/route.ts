import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const schedules = await prisma.servicingSchedule.findMany({
    include: { organisation: { select: { id: true, companyName: true } } },
    orderBy: [{ organisation: { companyName: "asc" } }, { region: "asc" }],
  });
  return NextResponse.json({ schedules });
}

const upsertSchema = z.object({
  organisationId: z.string().min(1),
  // "" (the default) = the client's default/metro schedule; a named region
  // otherwise. Never null — see the schema comment on ServicingSchedule.region.
  region: z.string().default(""),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  minimumOrderThreshold: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

// Upsert on (organisationId, region) — editing a client's schedule updates
// the existing row rather than accumulating duplicates for the same
// client+region pair.
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { organisationId, region, daysOfWeek, minimumOrderThreshold, notes, active } = parsed.data;

  const schedule = await prisma.servicingSchedule.upsert({
    where: { organisationId_region: { organisationId, region } },
    update: { daysOfWeek, minimumOrderThreshold, notes, active: active ?? true },
    create: { organisationId, region, daysOfWeek, minimumOrderThreshold, notes, active: active ?? true },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "servicing_schedule.upserted",
    recordType: "ServicingSchedule",
    recordId: schedule.id,
    after: { organisationId, region, daysOfWeek },
  });

  return NextResponse.json({ schedule });
}
