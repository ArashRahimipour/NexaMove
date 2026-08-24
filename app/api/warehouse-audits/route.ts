import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { saveUpload } from "@/lib/storage";
import { WAREHOUSE_AUDIT_CATEGORIES } from "@/lib/warehouseAudit";

const itemSchema = z.object({
  category: z.enum(WAREHOUSE_AUDIT_CATEGORIES),
  result: z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]),
  critical: z.boolean().default(false),
  photoDataUrl: z.string().startsWith("data:image/").optional(),
  correctiveAction: z.string().optional(),
  dueDate: z.string().optional(),
});

const createSchema = z.object({
  organisationId: z.string().optional(),
  driverId: z.string().min(1),
  vehicleId: z.string().optional(),
  auditedAt: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { organisationId, driverId, vehicleId, auditedAt, notes, items } = parsed.data;

  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  if (!driver || driver.role !== "DRIVER") return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const uploadedItems = await Promise.all(
    items.map(async (item) => {
      const photo = item.photoDataUrl ? await saveUpload(item.photoDataUrl, "warehouse-audit") : null;
      return { ...item, photoUrl: photo?.url };
    })
  );

  const audit = await prisma.warehouseAudit.create({
    data: {
      organisationId,
      driverId,
      vehicleId,
      auditorId: auth.session.user.id,
      auditedAt: auditedAt ? new Date(auditedAt) : undefined,
      notes,
      items: {
        create: uploadedItems.map((item) => ({
          category: item.category,
          result: item.result,
          critical: item.critical,
          photoUrl: item.photoUrl,
          correctiveAction: item.correctiveAction,
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        })),
      },
    },
    include: { items: true },
  });

  const criticalFails = audit.items.filter((i) => i.result === "FAIL" && i.critical);
  if (criticalFails.length > 0) {
    await prisma.alert.create({
      data: {
        type: "WAREHOUSE_AUDIT_CRITICAL_FAIL",
        driverId,
        message: `Warehouse audit for ${driver.name}: ${criticalFails.length} critical item${criticalFails.length === 1 ? "" : "s"} failed (${criticalFails
          .map((i) => i.category.replaceAll("_", " ").toLowerCase())
          .join(", ")}).`,
      },
    });
  }

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "warehouse_audit.created",
    recordType: "WarehouseAudit",
    recordId: audit.id,
    after: { driverId, itemCount: audit.items.length, criticalFails: criticalFails.length },
  });

  return NextResponse.json({ audit }, { status: 201 });
}

export async function GET() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const audits = await prisma.warehouseAudit.findMany({
    include: {
      driver: { select: { id: true, name: true } },
      auditor: { select: { id: true, name: true } },
      vehicle: { select: { id: true, registration: true } },
      organisation: { select: { id: true, companyName: true } },
      items: true,
    },
    orderBy: { auditedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ audits });
}
