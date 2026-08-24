import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { saveUpload } from "@/lib/storage";

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const organisationId = searchParams.get("organisationId");

  const trainings = await prisma.clientDriverTraining.findMany({
    where: organisationId ? { organisationId } : {},
    include: {
      driver: { select: { id: true, name: true } },
      organisation: { select: { companyName: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { completedAt: "desc" },
  });
  return NextResponse.json({ trainings });
}

const createSchema = z.object({
  organisationId: z.string().min(1),
  driverId: z.string().min(1),
  trainingType: z.enum(["INDUCTION", "PRODUCT_HANDLING", "ASSEMBLY", "CUSTOMER_SERVICE"]),
  completedAt: z.string(),
  expiresAt: z.string().optional(),
  documentDataUrl: z.string().startsWith("data:").optional(),
});

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const document = data.documentDataUrl ? await saveUpload(data.documentDataUrl, "training-documents") : null;

  const training = await prisma.clientDriverTraining.create({
    data: {
      organisationId: data.organisationId,
      driverId: data.driverId,
      trainingType: data.trainingType,
      completedAt: new Date(data.completedAt),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      documentUrl: document?.url,
      approvedById: auth.session.user.id,
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "client_driver_training.recorded",
    recordType: "ClientDriverTraining",
    recordId: training.id,
    after: { driverId: data.driverId, trainingType: data.trainingType },
  });

  return NextResponse.json({ training }, { status: 201 });
}
