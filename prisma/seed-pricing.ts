// Seeds the pricing engine with the real, confirmed QLD rate cards and
// formulas supplied for NexaMove. Idempotent — safe to re-run.
//   npm run db:seed:pricing
//
// What's seeded as CONFIRMED (needsConfirmation: false):
// - Service types: Small Goods, Standard Delivery (the two with real
//   supplied CBM-band pricing), plus placeholders for the rest.
// - CBM bands for Small Goods (2 bands) and Standard (17 bands).
// - Rate cards "QLD New Standard" and "QLD New Deluxe" with every price
//   exactly as supplied. "QLD New Standard" is the QLD default; "QLD New
//   Deluxe" is a second selectable card (never auto-picked).
// - Fuel levy: 10.65% for QLD, effective now.
// - GST: 10% (set on AppSettings, already the schema default).
//
// What's seeded as NEEDS CONFIRMATION (no invented numbers, per the
// explicit "do not guess missing commercial rules" requirement):
// - Delivery zones (BNE, GC, SC, NNS, TOO, INT, ...) — codes only, no
//   adjustment amounts. An admin must set the model + numbers once the
//   historical invoices are reviewed.
// - Pricing extras (assembly, stairs, additional labour) — no dollar
//   amounts yet.
// - Carrier service code mappings ("Del Stand", "Ex Standa", ...) — a
//   suggested label only; an admin must confirm the actual ServiceType.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SMALL_GOODS_BANDS = [
  { min: 0, max: 0.4, label: "0–0.4 CBM" },
  { min: 0.4, max: 0.8, label: "0.4–0.8 CBM" },
];

const STANDARD_BANDS = [
  { min: 0, max: 0.4, label: "0–0.4 CBM" },
  { min: 0.4, max: 0.8, label: "0.4–0.8 CBM" },
  { min: 0.8, max: 2, label: "0.8–2 CBM" },
  { min: 2, max: 3, label: "2–3 CBM" },
  { min: 3, max: 4, label: "3–4 CBM" },
  { min: 4, max: 5, label: "4–5 CBM" },
  { min: 5, max: 6, label: "5–6 CBM" },
  { min: 6, max: 7, label: "6–7 CBM" },
  { min: 7, max: 8, label: "7–8 CBM" },
  { min: 8, max: 9, label: "8–9 CBM" },
  { min: 9, max: 10, label: "9–10 CBM" },
  { min: 10, max: 11, label: "10–11 CBM" },
  { min: 11, max: 12, label: "11–12 CBM" },
  { min: 12, max: 13, label: "12–13 CBM" },
  { min: 13, max: 14, label: "13–14 CBM" },
  { min: 14, max: 15, label: "14–15 CBM" },
  { min: 15, max: null, label: "15+ CBM" },
];

const QLD_STANDARD_SMALL_GOODS = [27.5, 49.5];
const QLD_STANDARD_STANDARD = [
  49.5, 71.5, 115.5, 159.5, 203.5, 247.5, 291.5, 335.5, 379.5, 423.5, 467.5, 511.5, 555.5, 599.5, 643.5, 687.5, null,
];

const QLD_DELUXE_SMALL_GOODS = [22.0, 33.0];
const QLD_DELUXE_STANDARD = [
  38.5, 49.5, 82.5, 115.0, 148.5, 181.5, 214.5, 247.5, 280.5, 313.5, 346.5, 379.5, 412.5, 445.5, 478.5, 511.5, null,
];

const SERVICE_TYPES = [
  { code: "SMALL_GOODS", label: "Small Goods" },
  { code: "STANDARD", label: "Standard Delivery" },
  { code: "DELUXE", label: "Deluxe Delivery" },
  { code: "EXCHANGE", label: "Exchange" },
  { code: "REDELIVERY", label: "Redelivery" },
  { code: "FAILED_DELIVERY", label: "Failed Delivery" },
  { code: "ASSEMBLY", label: "Assembly" },
  { code: "STORE_TRANSFER", label: "Store Transfer" },
  { code: "PICKUP_RETURN", label: "Pickup/Return" },
  { code: "OTHER", label: "Other" },
];

const ZONE_CODES = ["BNE", "BNE-", "BNE-I", "GC", "GC-", "SC", "NNS", "TOO", "INT"];

const CARRIER_CODES = [
  { sourceCode: "Del Stand", suggestedLabel: "Likely: Standard Delivery" },
  { sourceCode: "Ex Standa", suggestedLabel: "Likely: Exchange (Standard)" },
  { sourceCode: "Del Small", suggestedLabel: "Likely: Small Goods Delivery" },
  { sourceCode: "Ex Small", suggestedLabel: "Likely: Exchange (Small Goods)" },
];

async function seedBands(serviceTypeId: string, bands: { min: number; max: number | null; label: string }[]) {
  const out: string[] = [];
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    const existing = await prisma.cbmBand.findFirst({ where: { serviceTypeId, sortOrder: i } });
    const band = existing
      ? await prisma.cbmBand.update({ where: { id: existing.id }, data: { minCbm: b.min, maxCbm: b.max, label: b.label } })
      : await prisma.cbmBand.create({ data: { serviceTypeId, minCbm: b.min, maxCbm: b.max, label: b.label, sortOrder: i } });
    out.push(band.id);
  }
  return out;
}

async function seedRateCard(params: {
  name: string;
  state: string;
  isDefault: boolean;
  smallGoodsServiceTypeId: string;
  standardServiceTypeId: string;
  smallGoodsBandIds: string[];
  standardBandIds: string[];
  smallGoodsPrices: number[];
  standardPrices: (number | null)[];
}) {
  const existing = await prisma.rateCard.findFirst({ where: { name: params.name } });
  const rateCard = existing
    ? await prisma.rateCard.update({ where: { id: existing.id }, data: { state: params.state, isDefault: params.isDefault, active: true } })
    : await prisma.rateCard.create({ data: { name: params.name, state: params.state, isDefault: params.isDefault, active: true } });

  for (let i = 0; i < params.smallGoodsBandIds.length; i++) {
    await prisma.rateCardLine.upsert({
      where: {
        rateCardId_serviceTypeId_cbmBandId: {
          rateCardId: rateCard.id,
          serviceTypeId: params.smallGoodsServiceTypeId,
          cbmBandId: params.smallGoodsBandIds[i],
        },
      },
      update: { price: params.smallGoodsPrices[i], needsConfirmation: false },
      create: {
        rateCardId: rateCard.id,
        serviceTypeId: params.smallGoodsServiceTypeId,
        cbmBandId: params.smallGoodsBandIds[i],
        price: params.smallGoodsPrices[i],
        needsConfirmation: false,
      },
    });
  }

  for (let i = 0; i < params.standardBandIds.length; i++) {
    const price = params.standardPrices[i];
    await prisma.rateCardLine.upsert({
      where: {
        rateCardId_serviceTypeId_cbmBandId: {
          rateCardId: rateCard.id,
          serviceTypeId: params.standardServiceTypeId,
          cbmBandId: params.standardBandIds[i],
        },
      },
      update: { price, needsConfirmation: price == null },
      create: {
        rateCardId: rateCard.id,
        serviceTypeId: params.standardServiceTypeId,
        cbmBandId: params.standardBandIds[i],
        price,
        needsConfirmation: price == null,
      },
    });
  }

  return rateCard;
}

async function main() {
  const serviceTypeIds: Record<string, string> = {};
  for (const st of SERVICE_TYPES) {
    const row = await prisma.serviceType.upsert({
      where: { code: st.code },
      update: { label: st.label },
      create: { code: st.code, label: st.label },
    });
    serviceTypeIds[st.code] = row.id;
  }

  const smallGoodsBandIds = await seedBands(serviceTypeIds.SMALL_GOODS, SMALL_GOODS_BANDS);
  const standardBandIds = await seedBands(serviceTypeIds.STANDARD, STANDARD_BANDS);

  await seedRateCard({
    name: "QLD New Standard",
    state: "QLD",
    isDefault: true,
    smallGoodsServiceTypeId: serviceTypeIds.SMALL_GOODS,
    standardServiceTypeId: serviceTypeIds.STANDARD,
    smallGoodsBandIds,
    standardBandIds,
    smallGoodsPrices: QLD_STANDARD_SMALL_GOODS,
    standardPrices: QLD_STANDARD_STANDARD,
  });

  await seedRateCard({
    name: "QLD New Deluxe",
    state: "QLD",
    isDefault: false,
    smallGoodsServiceTypeId: serviceTypeIds.SMALL_GOODS,
    standardServiceTypeId: serviceTypeIds.STANDARD,
    smallGoodsBandIds,
    standardBandIds,
    smallGoodsPrices: QLD_DELUXE_SMALL_GOODS,
    standardPrices: QLD_DELUXE_STANDARD,
  });

  await prisma.fuelLevyRule.upsert({
    where: { id: "seed-qld-default-fuel-levy" },
    update: { percentage: 10.65, active: true },
    create: {
      id: "seed-qld-default-fuel-levy",
      state: "QLD",
      percentage: 10.65,
      active: true,
    },
  });

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: { gstPercentage: 10 },
    create: { id: "default", gstPercentage: 10 },
  });

  for (const code of ZONE_CODES) {
    await prisma.deliveryZone.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: code,
        state: "QLD",
        adjustmentModel: "NONE",
        needsConfirmation: true,
        notes: "Awaiting historical invoice data to determine the adjustment model and amounts.",
      },
    });
  }

  const extras: { code: string; label: string; amountType: "FIXED" | "PER_HOUR" }[] = [
    { code: "ASSEMBLY", label: "Assembly", amountType: "FIXED" },
    { code: "STAIRS", label: "Stairs", amountType: "FIXED" },
    { code: "ADDITIONAL_LABOUR", label: "Additional labour (per hour)", amountType: "PER_HOUR" },
  ];
  for (const e of extras) {
    await prisma.pricingExtra.upsert({
      where: { code: e.code },
      update: {},
      create: { code: e.code, label: e.label, amountType: e.amountType, amount: null, needsConfirmation: true },
    });
  }

  for (const c of CARRIER_CODES) {
    await prisma.carrierServiceCodeMapping.upsert({
      where: { sourceCode: c.sourceCode },
      update: {},
      create: { sourceCode: c.sourceCode, suggestedLabel: c.suggestedLabel, confirmed: false },
    });
  }

  console.log("Pricing engine seeded: service types, CBM bands, QLD New Standard + QLD New Deluxe rate cards, 10.65% QLD fuel levy.");
  console.log("Needs admin confirmation: delivery zone adjustment models, pricing extra amounts, carrier code mappings.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
