import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { saveUpload } from "@/lib/storage";
import { MORNING_COMM_ISSUE_TYPES } from "@/lib/morningComm";

const createSchema = z.object({
  organisationId: z.string().optional(),
  date: z.string().optional(),
  issueType: z.enum(MORNING_COMM_ISSUE_TYPES),
  deliveryId: z.string().optional(),
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  description: z.string().min(1),
  actionRequired: z.string().optional(),
  responsiblePerson: z.string().optional(),
  attachmentDataUrl: z.string().startsWith("data:image/").optional(),
});

// Deliberately allows a plain image upload rather than requiring a
// pre-existing delivery/driver record for every field — the whole point of
// this log (per the brief) is to capture overnight exceptions fast, from a
// tablet at the warehouse, before the day's runs start.
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const attachment = data.attachmentDataUrl ? await saveUpload(data.attachmentDataUrl, "morning-comms") : null;

  const log = await prisma.morningCommunicationLog.create({
    data: {
      organisationId: data.organisationId,
      date: data.date ? new Date(data.date) : new Date(),
      issueType: data.issueType,
      deliveryId: data.deliveryId,
      driverId: data.driverId,
      vehicleId: data.vehicleId,
      description: data.description,
      actionRequired: data.actionRequired,
      responsiblePerson: data.responsiblePerson,
      attachmentUrl: attachment?.url,
      createdById: auth.session.user.id,
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "morning_comm.created",
    recordType: "MorningCommunicationLog",
    recordId: log.id,
    after: { issueType: log.issueType, date: log.date },
  });

  return NextResponse.json({ log }, { status: 201 });
}

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const logs = await prisma.morningCommunicationLog.findMany({
    where: status ? { status: status as never } : {},
    include: {
      delivery: { select: { id: true, customerName: true, trackingCode: true } },
      driver: { select: { id: true, name: true } },
      vehicle: { select: { id: true, registration: true } },
      organisation: { select: { id: true, companyName: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  return NextResponse.json({ logs });
}
