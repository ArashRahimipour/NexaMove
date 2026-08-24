import { prisma } from "@/lib/prisma";
import type { DeliveryZone, RateCard } from "@prisma/client";

// Central pricing engine — the single source of truth for delivery pricing.
// Every caller (calculator, delivery creation, dispatch, client portal,
// settlement comparison, KPI/margin reporting) must go through these
// functions rather than re-deriving prices per page. See docs/PRICING.md.

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// CBM banding
// ---------------------------------------------------------------------------

// Deterministic boundary rule: bands are sorted ascending by maxCbm (null =
// open-ended, treated as +Infinity), and the CBM value is assigned to the
// FIRST band where cbm <= band.maxCbm. This makes every boundary inclusive
// on its upper edge — 0.400 falls in a "0–0.4" band, and 7.00 falls in a
// "6–7" band, never the next one up — matching the supplied rate-card
// examples exactly.
export async function resolveCbmBand(serviceTypeId: string, cbm: number) {
  const bands = await prisma.cbmBand.findMany({
    where: { serviceTypeId },
    orderBy: { sortOrder: "asc" },
  });
  const sorted = [...bands].sort((a, b) => (a.maxCbm ?? Infinity) - (b.maxCbm ?? Infinity));
  return sorted.find((b) => cbm <= (b.maxCbm ?? Infinity)) ?? null;
}

// ---------------------------------------------------------------------------
// Rate card resolution — never silently falls back without recording which
// tier was actually used (see PricingQuote.ruleIdSnapshot).
// ---------------------------------------------------------------------------

export type RateCardTier = "CLIENT_SPECIFIC" | "STATE_DEFAULT" | "COMPANY_DEFAULT" | "MANUAL_SELECTION";

export async function resolveRateCard(params: {
  organisationId?: string | null;
  state: string;
  at?: Date;
}): Promise<{ rateCard: RateCard; tier: RateCardTier } | null> {
  const at = params.at ?? new Date();
  const activeWhere = {
    active: true,
    effectiveFrom: { lte: at },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
  };

  if (params.organisationId) {
    const clientCard = await prisma.rateCard.findFirst({
      where: { ...activeWhere, organisationId: params.organisationId },
      orderBy: { effectiveFrom: "desc" },
    });
    if (clientCard) return { rateCard: clientCard, tier: "CLIENT_SPECIFIC" };
  }

  // isDefault marks the ONE card per scope that auto-resolves — other cards
  // for the same state (e.g. a Deluxe tier alongside the Standard default)
  // coexist for explicit selection via QuoteInput.rateCardId, never guessed.
  const stateCard = await prisma.rateCard.findFirst({
    where: { ...activeWhere, organisationId: null, state: params.state, isDefault: true },
    orderBy: { effectiveFrom: "desc" },
  });
  if (stateCard) return { rateCard: stateCard, tier: "STATE_DEFAULT" };

  const defaultCard = await prisma.rateCard.findFirst({
    where: { ...activeWhere, organisationId: null, state: null, isDefault: true },
    orderBy: { effectiveFrom: "desc" },
  });
  if (defaultCard) return { rateCard: defaultCard, tier: "COMPANY_DEFAULT" };

  return null;
}

// ---------------------------------------------------------------------------
// Zone adjustment
// ---------------------------------------------------------------------------

export function computeZoneAdjustment(baseRate: number, zone: DeliveryZone | null): number {
  if (!zone) return 0;
  switch (zone.adjustmentModel) {
    case "FIXED_SURCHARGE":
      return zone.fixedSurcharge ?? 0;
    case "MULTIPLIER":
      return zone.multiplier ? round2(baseRate * (zone.multiplier - 1)) : 0;
    // FIXED_TABLE is handled by resolving a different rate card entirely
    // (zone.overrideRateCardId), not as an adjustment on top of the base.
    // CLIENT_NEGOTIATED and NONE apply no automatic adjustment.
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Fuel levy — most specific match wins: organisation > rate card > state >
// company-wide default. Never a hard-coded percentage.
// ---------------------------------------------------------------------------

export async function resolveFuelLevy(params: {
  organisationId?: string | null;
  state: string;
  rateCardId?: string | null;
  at?: Date;
}): Promise<{ percentage: number; ruleId: string } | null> {
  const at = params.at ?? new Date();
  const activeWhere = {
    active: true,
    effectiveFrom: { lte: at },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
  };

  if (params.organisationId) {
    const orgRule = await prisma.fuelLevyRule.findFirst({
      where: { ...activeWhere, organisationId: params.organisationId },
      orderBy: { effectiveFrom: "desc" },
    });
    if (orgRule) return { percentage: orgRule.percentage, ruleId: orgRule.id };
  }

  if (params.rateCardId) {
    const cardRule = await prisma.fuelLevyRule.findFirst({
      where: { ...activeWhere, rateCardId: params.rateCardId },
      orderBy: { effectiveFrom: "desc" },
    });
    if (cardRule) return { percentage: cardRule.percentage, ruleId: cardRule.id };
  }

  const stateRule = await prisma.fuelLevyRule.findFirst({
    where: { ...activeWhere, organisationId: null, rateCardId: null, state: params.state },
    orderBy: { effectiveFrom: "desc" },
  });
  if (stateRule) return { percentage: stateRule.percentage, ruleId: stateRule.id };

  const companyRule = await prisma.fuelLevyRule.findFirst({
    where: { ...activeWhere, organisationId: null, rateCardId: null, state: null },
    orderBy: { effectiveFrom: "desc" },
  });
  if (companyRule) return { percentage: companyRule.percentage, ruleId: companyRule.id };

  return null;
}

// fuelLevy = fuelLevyBase (the nett delivery charge) x fuelLevyPercentage.
export function computeFuelLevy(nettCharge: number, percentage: number): number {
  return round2(nettCharge * (percentage / 100));
}

// GST is calculated after fuel levy and taxable extras:
// subtotalExGst = nettCharge + fuelLevy (+ any extras already folded into nett)
// gst = subtotalExGst x gstPercentage
export function computeGst(subtotalExGst: number, gstPercentage: number): number {
  return round2(subtotalExGst * (gstPercentage / 100));
}

// ---------------------------------------------------------------------------
// Margin — GST is never counted as company revenue or driver payment.
// ---------------------------------------------------------------------------

export function computeMargin(nettRevenue: number, driverPaymentPercent: number) {
  const driverPayment = round2(nettRevenue * (driverPaymentPercent / 100));
  const companyMargin = round2(nettRevenue - driverPayment);
  return { driverPayment, companyMargin };
}

// ---------------------------------------------------------------------------
// Full quote computation
// ---------------------------------------------------------------------------

export interface QuoteInput {
  organisationId?: string | null;
  state: string;
  originPostcode?: string;
  destPostcode: string;
  zoneCode?: string;
  serviceTypeCode: string;
  // Explicitly pick a rate card (e.g. "QLD New Deluxe") instead of letting
  // priority resolution pick the state/company default. Never guessed —
  // only used when the caller (calculator UI) actually selects one.
  rateCardId?: string;
  cbm: number;
  weight?: number;
  quantity?: number;
  assemblyRequired?: boolean;
  stairs?: boolean;
  additionalLabourHours?: number;
  otherSurcharge?: number;
  fuelLevyOverridePercentage?: number; // permission-controlled at the API layer
  currentCarrierPrice?: number;
  driverPaymentPercentOverride?: number;
  at?: Date;
}

export interface QuoteResult {
  found: boolean;
  reason?: string;
  serviceTypeId?: string;
  serviceTypeLabel?: string;
  cbmBandId?: string;
  cbmBandLabel?: string;
  zoneId?: string;
  zoneName?: string;
  baseRate?: number;
  zoneAdjustment?: number;
  assemblyCharge?: number;
  otherExtras?: number;
  nettCharge?: number;
  fuelLevyPercentage?: number;
  fuelLevyAmount?: number;
  fuelLevyRuleId?: string;
  gstPercentage?: number;
  gstAmount?: number;
  totalPrice?: number;
  rateCardId?: string;
  rateCardName?: string;
  rateCardEffectiveFrom?: Date;
  rateCardTier?: RateCardTier;
  ruleId?: string;
  driverPaymentPercent?: number;
  driverPayment?: number;
  companyMargin?: number;
  savingDollar?: number | null;
  savingPercent?: number | null;
}

export async function computeQuote(input: QuoteInput): Promise<QuoteResult> {
  const at = input.at ?? new Date();

  const serviceType = await prisma.serviceType.findUnique({ where: { code: input.serviceTypeCode } });
  if (!serviceType) return { found: false, reason: `Unknown service type "${input.serviceTypeCode}"` };

  const cbmBand = await resolveCbmBand(serviceType.id, input.cbm);
  if (!cbmBand) return { found: false, reason: `No CBM band configured for ${input.cbm} CBM under ${serviceType.label}` };

  const zone = input.zoneCode
    ? await prisma.deliveryZone.findUnique({ where: { code: input.zoneCode } })
    : null;

  const zoneOverrideCard =
    zone?.adjustmentModel === "FIXED_TABLE" && zone.overrideRateCardId
      ? await prisma.rateCard.findUnique({ where: { id: zone.overrideRateCardId } })
      : null;
  const manualCard = input.rateCardId ? await prisma.rateCard.findUnique({ where: { id: input.rateCardId } }) : null;

  const resolved = manualCard
    ? { rateCard: manualCard, tier: "MANUAL_SELECTION" as RateCardTier }
    : zoneOverrideCard
      ? { rateCard: zoneOverrideCard, tier: "STATE_DEFAULT" as RateCardTier }
      : await resolveRateCard({ organisationId: input.organisationId, state: input.state, at });

  if (!resolved) return { found: false, reason: `No active rate card found for state ${input.state}` };

  const line = await prisma.rateCardLine.findUnique({
    where: {
      rateCardId_serviceTypeId_cbmBandId: {
        rateCardId: resolved.rateCard.id,
        serviceTypeId: serviceType.id,
        cbmBandId: cbmBand.id,
      },
    },
  });
  if (!line || line.price == null) {
    return {
      found: false,
      reason: `Rate card "${resolved.rateCard.name}" has no confirmed price for ${serviceType.label} / ${cbmBand.label}`,
    };
  }

  const baseRate = line.price;
  let zoneAdjustment = computeZoneAdjustment(baseRate, zone);
  const extras = await prisma.pricingExtra.findMany({ where: { active: true } });
  const assemblyExtra = extras.find((e) => e.code === "ASSEMBLY");
  const stairsExtra = extras.find((e) => e.code === "STAIRS");
  const labourExtra = extras.find((e) => e.code === "ADDITIONAL_LABOUR");

  const assemblyCharge = input.assemblyRequired ? assemblyExtra?.amount ?? 0 : 0;
  const stairsCharge = input.stairs ? stairsExtra?.amount ?? 0 : 0;
  const labourCharge =
    input.additionalLabourHours && labourExtra?.amount
      ? round2(input.additionalLabourHours * labourExtra.amount)
      : 0;
  const otherExtras = round2(stairsCharge + labourCharge + (input.otherSurcharge ?? 0));

  let nettCharge = round2(baseRate + zoneAdjustment + assemblyCharge + otherExtras);
  if (zone?.minimumCharge && nettCharge < zone.minimumCharge) {
    zoneAdjustment = round2(zoneAdjustment + (zone.minimumCharge - nettCharge));
    nettCharge = zone.minimumCharge;
  }

  const fuelLevy = input.fuelLevyOverridePercentage != null
    ? { percentage: input.fuelLevyOverridePercentage, ruleId: "override" }
    : await resolveFuelLevy({ organisationId: input.organisationId, state: input.state, rateCardId: resolved.rateCard.id, at });

  const fuelLevyPercentage = fuelLevy?.percentage ?? 0;
  const fuelLevyAmount = computeFuelLevy(nettCharge, fuelLevyPercentage);

  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  const gstPercentage = settings?.gstPercentage ?? 10; // Australian default, configurable in Settings.

  const subtotalExGst = round2(nettCharge + fuelLevyAmount);
  const gstAmount = computeGst(subtotalExGst, gstPercentage);
  const totalPrice = round2(subtotalExGst + gstAmount);

  const driverPaymentPercent = input.driverPaymentPercentOverride ?? settings?.defaultDriverSplitPercent ?? 60;
  const { driverPayment, companyMargin } = computeMargin(nettCharge, driverPaymentPercent);

  const savingDollar = input.currentCarrierPrice != null ? round2(input.currentCarrierPrice - totalPrice) : null;
  const savingPercent =
    input.currentCarrierPrice != null && input.currentCarrierPrice > 0
      ? round2((savingDollar! / input.currentCarrierPrice) * 100)
      : null;

  return {
    found: true,
    serviceTypeId: serviceType.id,
    serviceTypeLabel: serviceType.label,
    cbmBandId: cbmBand.id,
    cbmBandLabel: cbmBand.label,
    zoneId: zone?.id,
    zoneName: zone?.name,
    baseRate,
    zoneAdjustment,
    assemblyCharge,
    otherExtras,
    nettCharge,
    fuelLevyPercentage,
    fuelLevyAmount,
    fuelLevyRuleId: fuelLevy?.ruleId,
    gstPercentage,
    gstAmount,
    totalPrice,
    rateCardId: resolved.rateCard.id,
    rateCardName: resolved.rateCard.name,
    rateCardEffectiveFrom: resolved.rateCard.effectiveFrom,
    rateCardTier: resolved.tier,
    ruleId: line.id,
    driverPaymentPercent,
    driverPayment,
    companyMargin,
    savingDollar,
    savingPercent,
  };
}
