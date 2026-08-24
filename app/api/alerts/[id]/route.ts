import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const patchSchema = z.object({ action: z.enum(["acknowledge", "resolve"]) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const alert = await prisma.alert.update({
    where: { id: params.id },
    data:
      parsed.data.action === "acknowledge"
        ? { status: "ACKNOWLEDGED", acknowledgedById: auth.session.user.id, acknowledgedAt: new Date() }
        : { status: "RESOLVED", resolvedById: auth.session.user.id, resolvedAt: new Date() },
  });

  return NextResponse.json({ alert });
}
