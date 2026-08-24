import { prisma } from "@/lib/prisma";
import { resolveCbmBand, computeGst, round2 } from "@/lib/pricing/engine";

// Koala Living-specific pricing composition, layered on top of the generic
// rate-card engine (lib/pricing/engine.ts) rather than replacing it.
//
// Koala's supplied pricing algorithm is: postcode -> zone -> total CBM ->
// category eligibility -> CBM band -> Express base rate -> + Deluxe surcharge
// (if selected) -> + fixed extras (return / late cancellation / futile
// delivery) -> one GST-inclusive customer price. The generic engine's
// computeQuote() prices one service type per call and applies GST inside
// that same call, which would double-apply GST if called once for Express
// and again for Deluxe. This module composes the smaller building blocks
// (resolveCbmBand, computeGst, round2) itself so fuel levy/GST are applied
// exactly once, on the combined total — see computeKoalaQuote below.
//
// Nothing here invents a number: every dollar amount is read from the
// "Koala Living QLD Standard" / "Koala Living QLD Deluxe" rate cards or the
// KOALA_* PricingExtra rows (prisma/seed-koala-pricing.ts), and anything not
// yet supplied by Koala comes back with needsConfirmation entries rather
// than a guessed value.

export const KOALA_ORG_NAME = "Koala Living";
export const KOALA_EXPRESS_RATE_CARD_NAME = "Koala Living QLD Standard";
export const KOALA_DELUXE_RATE_CARD_NAME = "Koala Living QLD Deluxe";

export const KOALA_ZONE_CODES = {
  A: "KOALA-ZONE-A",
  B: "KOALA-ZONE-B",
  REGIONAL: "KOALA-REGIONAL-QLD",
} as const;

// Koala's brief: "Small Goods applies only within Zone A... CBM > 0.8 in
// Zone A automatically uses STANDARD... Zone B or beyond uses STANDARD
// irrespective of Small Goods category." The upper-inclusive boundary
// convention (0.800 falls in the 0.4-0.8 Small Goods band, not the next
// Standard band) matches the CBM-band matching rule already established
// and tested elsewhere in this engine (resolveCbmBand) — applied here for
// consistency, flagged as an inherited assumption rather than a fresh guess,
// since Koala's own sheet doesn't spell out the boundary rule in words.
const SMALL_GOODS_MAX_CBM = 0.8;

export type KoalaCategory = "SMALL_GOODS" | "STANDARD";

export interface KoalaQuoteInput {
  organisationId: string;
  postcode: string;
  cbm: number;
  deluxe?: boolean;
  returnCharge?: boolean;
  lateCancellation?: boolean;
  futileDelivery?: boolean;
  at?: Date;
}

export interface KoalaQuoteResult {
  found: boolean;
  reason?: string;
  /** Machine-readable list of anything in this quote that isn't confirmed real Koala data yet. */
  needsConfirmation: string[];
  postcode?: string;
  zoneCode?: string;
  zoneName?: string;
  totalCbm?: number;
  category?: KoalaCategory;
  cbmBandLabel?: string;
  expressRate?: number;
  deluxeApplied?: boolean;
  deluxeCharge?: number;
  returnCharge?: number;
  lateCancellationCharge?: number;
  futileDeliveryCharge?: number;
  exGstTotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  finalCustomerCharge?: number;
  expressRateCardId?: string;
  expressRateCardName?: string;
  deluxeRateCardId?: string;
}

// Zone lookup is postcode-list-first (an official Koala mapping, entered via
// the existing Delivery Zones admin screen), never distance-calculated —
// per "preferred order: official mapping, then configured mapping, only
// calculated distance as a last resort." No distance fallback is
// implemented yet because it must never be reached before those two are
// exhausted, and doing so silently would risk mispricing a real delivery.
export async function resolveKoalaZone(postcode: string) {
  const zones = await prisma.deliveryZone.findMany({
    where: { code: { in: Object.values(KOALA_ZONE_CODES) } },
  });
  const normalised = postcode.trim();
  return (
    zones.find((z) =>
      (z.postcodes ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .includes(normalised)
    ) ?? null
  );
}

export function resolveKoalaCategory(zoneCode: string, cbm: number): KoalaCategory {
  if (zoneCode === KOALA_ZONE_CODES.A && cbm <= SMALL_GOODS_MAX_CBM) return "SMALL_GOODS";
  return "STANDARD";
}

async function findActiveRateCardByName(name: string, at: Date) {
  return prisma.rateCard.findFirst({
    where: {
      name,
      active: true,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

async function resolveFixedCharge(code: string, needsConfirmation: string[]): Promise<number> {
  const extra = await prisma.pricingExtra.findUnique({ where: { code } });
  if (!extra || !extra.active || extra.amount == null) {
    needsConfirmation.push(`${code}_amount_not_confirmed`);
    return 0;
  }
  return extra.amount;
}

export async function computeKoalaQuote(input: KoalaQuoteInput): Promise<KoalaQuoteResult> {
  const needsConfirmation: string[] = [];
  const at = input.at ?? new Date();

  const zone = await resolveKoalaZone(input.postcode);
  if (!zone) {
    return {
      found: false,
      reason: `Postcode ${input.postcode} is not mapped to a Koala zone yet. Needs Koala's official postcode/zone list (Zone A ~55km / Zone B ~100km / Regional) entered under Admin → Pricing → Delivery Zones before this delivery can be priced.`,
      needsConfirmation: ["koala_postcode_zone_mapping"],
    };
  }

  const category = resolveKoalaCategory(zone.code, input.cbm);
  const serviceType = await prisma.serviceType.findUnique({ where: { code: category } });
  if (!serviceType) {
    return { found: false, reason: `Service type "${category}" is not configured.`, needsConfirmation: [] };
  }

  const band = await resolveCbmBand(serviceType.id, input.cbm);
  if (!band) {
    return {
      found: false,
      reason: `No CBM band configured for ${input.cbm} CBM under ${category}.`,
      needsConfirmation: [],
    };
  }

  const expressCard = await findActiveRateCardByName(KOALA_EXPRESS_RATE_CARD_NAME, at);
  if (!expressCard) {
    return {
      found: false,
      reason: `No active "${KOALA_EXPRESS_RATE_CARD_NAME}" rate card found. Run the Koala pricing seed first.`,
      needsConfirmation: ["koala_rate_card_missing"],
    };
  }

  const expressLine = await prisma.rateCardLine.findUnique({
    where: {
      rateCardId_serviceTypeId_cbmBandId: {
        rateCardId: expressCard.id,
        serviceTypeId: serviceType.id,
        cbmBandId: band.id,
      },
    },
  });
  if (!expressLine || expressLine.price == null) {
    return {
      found: false,
      reason: `"${expressCard.name}" has no confirmed price for ${category} / ${band.label}.`,
      needsConfirmation: ["koala_rate_card_line_missing"],
    };
  }

  let deluxeCharge = 0;
  let deluxeRateCardId: string | undefined;
  if (input.deluxe) {
    const deluxeCard = await findActiveRateCardByName(KOALA_DELUXE_RATE_CARD_NAME, at);
    const deluxeLine = deluxeCard
      ? await prisma.rateCardLine.findUnique({
          where: {
            rateCardId_serviceTypeId_cbmBandId: {
              rateCardId: deluxeCard.id,
              serviceTypeId: serviceType.id,
              cbmBandId: band.id,
            },
          },
        })
      : null;
    if (deluxeLine?.price != null && deluxeCard) {
      deluxeCharge = deluxeLine.price;
      deluxeRateCardId = deluxeCard.id;
    } else {
      needsConfirmation.push("koala_deluxe_rate_not_confirmed");
    }
  }

  const returnCharge = input.returnCharge ? await resolveFixedCharge("KOALA_RETURN", needsConfirmation) : 0;
  const lateCancellationCharge = input.lateCancellation
    ? await resolveFixedCharge("KOALA_LATE_CANCELLATION", needsConfirmation)
    : 0;
  const futileDeliveryCharge = input.futileDelivery
    ? await resolveFixedCharge("KOALA_FUTILE_DELIVERY", needsConfirmation)
    : 0;

  // Stairs, lift, and heavy-item handling are deliberately NOT priced here —
  // Koala's brief states these are already included in the agreed rate.
  // They're recorded on the delivery record for labour/vehicle planning
  // only, never added to the customer charge for this client.
  const exGstTotal = round2(expressLine.price + deluxeCharge + returnCharge + lateCancellationCharge + futileDeliveryCharge);

  // Koala's own supplied pricing steps go straight from base+extras to a
  // GST-inclusive total with no fuel-levy step (unlike the generic engine's
  // default QLD fuel levy) — assumed here to mean Koala's agreed rates are
  // fuel-levy-inclusive. Flagged for explicit confirmation rather than
  // silently inheriting the company-wide levy.
  needsConfirmation.push("confirm_whether_koala_pricing_includes_a_fuel_levy");

  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  const gstPercentage = settings?.gstPercentage ?? 10;
  const gstAmount = computeGst(exGstTotal, gstPercentage);
  const finalCustomerCharge = round2(exGstTotal + gstAmount);

  return {
    found: true,
    needsConfirmation,
    postcode: input.postcode,
    zoneCode: zone.code,
    zoneName: zone.name,
    totalCbm: input.cbm,
    category,
    cbmBandLabel: band.label,
    expressRate: expressLine.price,
    deluxeApplied: Boolean(input.deluxe && deluxeCharge > 0),
    deluxeCharge,
    returnCharge,
    lateCancellationCharge,
    futileDeliveryCharge,
    exGstTotal,
    gstPercentage,
    gstAmount,
    finalCustomerCharge,
    expressRateCardId: expressCard.id,
    expressRateCardName: expressCard.name,
    deluxeRateCardId,
  };
}
