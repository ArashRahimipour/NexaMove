import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const createOrgSchema = z.object({
  companyName: z.string().min(1),
  abn: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  portalUserEmail: z.string().email().optional().or(z.literal("")),
  portalUserPassword: z.string().min(8).optional().or(z.literal("")),
});

export async function GET() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const organisations = await prisma.organisation.findMany({
    include: { _count: { select: { deliveries: true, users: true } } },
    orderBy: { companyName: "asc" },
  });
  return NextResponse.json({ organisations });
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const organisation = await prisma.organisation.create({
    data: {
      companyName: data.companyName,
      abn: data.abn,
      contactName: data.contactName,
      email: data.email || undefined,
      phone: data.phone,
    },
  });

  if (data.portalUserEmail && data.portalUserPassword) {
    const existing = await prisma.user.findUnique({ where: { email: data.portalUserEmail.toLowerCase() } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(data.portalUserPassword, 12);
      await prisma.user.create({
        data: {
          name: data.contactName || data.companyName,
          email: data.portalUserEmail.toLowerCase(),
          passwordHash,
          role: "RETAIL_CLIENT",
          organisationId: organisation.id,
        },
      });
    }
  }

  return NextResponse.json({ organisation }, { status: 201 });
}
