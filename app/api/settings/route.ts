import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { getAppSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const settingsSchema = z.object({
  companyName: z.string().min(1),
  abn: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  regions: z.string().min(1),
  geofenceRadiusMetres: z.number().int().min(50).max(2000),
  photoRequiredForDelivery: z.boolean(),
  signatureRequired: z.boolean(),
  defaultDriverSplitPercent: z.number().min(0).max(100),
  gstPercentage: z.number().min(0).max(100),
});

export async function PATCH(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const before = await getAppSettings();

  const settings = await prisma.appSettings.update({
    where: { id: "default" },
    data: { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "settings.updated",
    recordType: "AppSettings",
    recordId: "default",
    before,
    after: settings,
  });

  return NextResponse.json({ settings });
}
