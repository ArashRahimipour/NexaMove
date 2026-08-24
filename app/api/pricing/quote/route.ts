import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { computeQuote } from "@/lib/pricing/engine";
import { canOverrideFuelLevy } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";

const quoteSchema = z.object({
  organisationId: z.string().optional(),
  state: z.string().min(2),
  originPostcode: z.string().optional(),
  destPostcode: z.string().min(1),
  zoneCode: z.string().optional(),
  serviceTypeCode: z.string(),
  rateCardId: z.string().optional(),
  cbm: z.number().positive(),
  weight: z.number().optional(),
  quantity: z.number().int().optional(),
  assemblyRequired: z.boolean().optional(),
  stairs: z.boolean().optional(),
  additionalLabourHours: z.number().optional(),
  otherSurcharge: z.number().optional(),
  fuelLevyOverridePercentage: z.number().optional(),
  currentCarrierPrice: z.number().optional(),
  driverPaymentPercentOverride: z.number().optional(),
  save: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER", "DISPATCHER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (data.fuelLevyOverridePercentage != null && !canOverrideFuelLevy(auth.session.user.role)) {
    return NextResponse.json({ error: "Only an admin can override the fuel levy" }, { status: 403 });
  }

  const result = await computeQuote(data);
  if (!result.found) {
    return NextResponse.json({ error: result.reason ?? "Unable to price this delivery" }, { status: 422 });
  }

  if (!data.save) {
    return NextResponse.json({ quote: result });
  }

  const count = await prisma.pricingQuote.count();
  const quoteNumber = `PQ-${String(count + 1).padStart(6, "0")}`;

  const saved = await prisma.pricingQuote.create({
    data: {
      quoteNumber,
      organisationId: data.organisationId,
      state: data.state,
      originPostcode: data.originPostcode,
      destPostcode: data.destPostcode,
      zoneId: result.zoneId,
      serviceTypeId: result.serviceTypeId!,
      cbmBandId: result.cbmBandId,
      cbm: data.cbm,
      weight: data.weight,
      quantity: data.quantity,
      assemblyRequired: data.assemblyRequired ?? false,
      stairs: data.stairs ?? false,
      additionalLabourHours: data.additionalLabourHours,
      otherSurcharge: data.otherSurcharge ?? 0,
      baseRate: result.baseRate!,
      zoneAdjustment: result.zoneAdjustment ?? 0,
      assemblyCharge: result.assemblyCharge ?? 0,
      otherExtras: result.otherExtras ?? 0,
      nettCharge: result.nettCharge!,
      fuelLevyPercentage: result.fuelLevyPercentage!,
      fuelLevyAmount: result.fuelLevyAmount!,
      gstPercentage: result.gstPercentage!,
      gstAmount: result.gstAmount!,
      totalPrice: result.totalPrice!,
      rateCardId: result.rateCardId,
      rateCardNameSnapshot: result.rateCardName!,
      ruleIdSnapshot: result.ruleId!,
      driverPaymentPercent: result.driverPaymentPercent!,
      driverPayment: result.driverPayment!,
      companyMargin: result.companyMargin!,
      currentCarrierPrice: data.currentCarrierPrice,
      createdById: auth.session.user.id,
    },
  });

  await writeAuditLog({
    userId: auth.session.user.id,
    action: "pricing_quote.created",
    recordType: "PricingQuote",
    recordId: saved.id,
    after: { quoteNumber, totalPrice: saved.totalPrice, rateCard: saved.rateCardNameSnapshot },
  });

  return NextResponse.json({ quote: result, saved: { id: saved.id, quoteNumber: saved.quoteNumber } });
}
