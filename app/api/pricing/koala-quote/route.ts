import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { computeKoalaQuote, KOALA_ORG_NAME } from "@/lib/pricing/koala";
import { prisma } from "@/lib/prisma";

const quoteSchema = z.object({
  postcode: z.string().min(4).max(4),
  cbm: z.number().positive(),
  deluxe: z.boolean().optional(),
  returnCharge: z.boolean().optional(),
  lateCancellation: z.boolean().optional(),
  futileDelivery: z.boolean().optional(),
});

// Koala-specific pricing preview — separate from the generic
// /api/pricing/quote route because Koala's precedence (zone -> category ->
// Express + Deluxe + fixed extras -> one GST pass) isn't the generic
// engine's one-service-type-per-call shape. See lib/pricing/koala.ts.
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const koala = await prisma.organisation.findFirst({ where: { companyName: KOALA_ORG_NAME } });
  if (!koala) {
    return NextResponse.json(
      { error: `"${KOALA_ORG_NAME}" organisation not found — run npm run db:seed:koala first.` },
      { status: 500 }
    );
  }

  const result = await computeKoalaQuote({ organisationId: koala.id, ...parsed.data });
  if (!result.found) {
    return NextResponse.json({ error: result.reason, needsConfirmation: result.needsConfirmation }, { status: 422 });
  }

  return NextResponse.json({ quote: result });
}
