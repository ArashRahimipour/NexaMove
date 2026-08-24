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

  const shifts = await prisma.warehouseRepresentativeShift.findMany({
    where: organisationId ? { organisationId } : {},
    include: { representative: { select: { name: true } }, organisation: { select: { companyName: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });
  return NextResponse.json({ shifts });
}

const createSchema = z.object({
  organisationId: z.string().optional(),
  representativeId: z.string().min(1),
  warehouse: z.string().min(1),
  date: z.string(),
  shift: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const shift = await prisma.warehouseRepresentativeShift.create({
    data: {
      organisationId: data.organisationId,
      representativeId: data.representativeId,
      warehouse: data.warehouse,
      date: new Date(data.date),
      shift: data.shift,
      notes: data.notes,
      createdById: auth.session.user.id,
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "warehouse_rep_shift.scheduled",
    recordType: "WarehouseRepresentativeShift",
    recordId: shift.id,
    after: { representativeId: data.representativeId, date: data.date, shift: data.shift },
  });

  return NextResponse.json({ shift }, { status: 201 });
}
