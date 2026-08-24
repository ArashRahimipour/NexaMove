// Seeds Koala Living's rate cards from the supplied "rate_card_comparision.xlsx":
//   - QLD figures (Small Goods, Standard/Express, Deluxe surcharge) are used
//     verbatim — they also exactly match the QLD figures already seeded
//     generically by seed-pricing.ts ("QLD New Standard"/"QLD New Deluxe").
//   - VIC/NSW figures were not given as dollar amounts in the sheet, only as
//     a percentage difference from QLD per band (e.g. Sydney 6-7 CBM
//     Standard = QLD 6-7 CBM x (1 + 0.048...)). Those are derived here
//     (documented per band below) and seeded as general state-default rate
//     cards, the same pattern as the existing QLD ones — NOT Koala-specific,
//     since Koala's own business is Queensland-only per the brief.
//   - Deluxe is seeded as a SEPARATE rate card holding the same
//     SMALL_GOODS/STANDARD service-type lines, mirroring exactly how
//     "QLD New Deluxe" already works — it is an amount to ADD to the Express
//     charge (lib/pricing/koala.ts composes the two), never a replacement.
//
// Explicitly NOT seeded here, because they were not supplied and must not
// be guessed: Koala's postcode->zone list (zones are created with no
// postcodes and needsConfirmation: true), and the Return / Late
// Cancellation / Futile Delivery fixed-charge amounts (created with
// amount: null and needsConfirmation: true).
//
// Run with: npm run db:seed:koala (after npm run db:seed:pricing).
import { PrismaClient } from "@prisma/client";
import { KOALA_ZONE_CODES } from "../lib/pricing/koala";

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

// --- Express / Standard — as supplied, QLD sheet ("STANDARD" columns) ---
const QLD_SMALL_GOODS = [27.5, 49.5];
const QLD_STANDARD = [
  49.5, 71.5, 115.5, 159.5, 203.5, 247.5, 291.5, 335.5, 379.5, 423.5, 467.5, 511.5, 555.5, 599.5, 643.5, 687.5, null,
];

// Derived: QLD x (1 + Melbourne %-difference) per band, from the sheet's
// "SMALL GOODS"/"STANDARD" comparison rows. 15+ was marked "TBC" for every
// state, so it stays unconfirmed (null) here too.
const VIC_SMALL_GOODS = [30.0, 50.0];
const VIC_STANDARD = [
  60.0, 70.0, 110.0, 124.0, 147.0, 147.0, 177.0, 177.0, 214.0, 214.0, 278.0, 325.0, 385.0, 445.0, 495.0, 565.0, null,
];

// Derived: QLD x (1 + Sydney %-difference) per band, same sheet.
const NSW_SMALL_GOODS = [25.0, 55.0];
const NSW_STANDARD = [
  65.0, 75.0, 121.0, 135.0, 147.0, 157.5, 168.0, 178.5, 194.25, 204.75, 225.75, 262.5, 315.0, 367.5, 399.0, 472.5, null,
];

// --- Deluxe surcharge (added ON TOP of Express, never a replacement) ---
const QLD_DELUXE_SMALL_GOODS = [22.0, 33.0];
const QLD_DELUXE_STANDARD = [
  38.5, 49.5, 82.5, 115.0, 148.5, 181.5, 214.5, 247.5, 280.5, 313.5, 346.5, 379.5, 412.5, 445.5, 478.5, 511.5, null,
];

const VIC_DELUXE_SMALL_GOODS = [20.0, 40.0];
const VIC_DELUXE_STANDARD = [
  55.0, 60.0, 75.0, 85.0, 105.0, 105.0, 130.0, 130.0, 160.0, 160.0, 210.0, 245.0, 340.0, 380.0, 420.0, 460.0, null,
];

const NSW_DELUXE_SMALL_GOODS = [35.0, 40.0];
const NSW_DELUXE_STANDARD = [
  60.0, 65.0, 81.16, 102.66, 112.88, 124.16, 134.38, 134.38, 155.88, 166.62, 215.0, 268.75, 376.25, 430.0, 470.0, 500.0, null,
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
  organisationId?: string;
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
    ? await prisma.rateCard.update({
        where: { id: existing.id },
        data: { state: params.state, organisationId: params.organisationId, isDefault: params.isDefault, active: true },
      })
    : await prisma.rateCard.create({
        data: {
          name: params.name,
          state: params.state,
          organisationId: params.organisationId,
          isDefault: params.isDefault,
          active: true,
        },
      });

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
  const smallGoods = await prisma.serviceType.upsert({
    where: { code: "SMALL_GOODS" },
    update: {},
    create: { code: "SMALL_GOODS", label: "Small Goods" },
  });
  const standard = await prisma.serviceType.upsert({
    where: { code: "STANDARD" },
    update: {},
    create: { code: "STANDARD", label: "Standard Delivery" },
  });

  const smallGoodsBandIds = await seedBands(smallGoods.id, SMALL_GOODS_BANDS);
  const standardBandIds = await seedBands(standard.id, STANDARD_BANDS);

  const koala = await prisma.organisation.upsert({
    where: { id: "koala-living" },
    update: { companyName: "Koala Living" },
    create: { id: "koala-living", companyName: "Koala Living", active: true },
  });

  // Koala's own client-specific cards — currently identical to the general
  // QLD default, but kept as their own versioned rate card per Koala's
  // requirement that Koala pricing never silently piggyback on a shared
  // default that other clients could change. Editing this card never
  // touches "QLD New Standard"/"QLD New Deluxe" or vice versa.
  await seedRateCard({
    name: "Koala Living QLD Standard",
    state: "QLD",
    organisationId: koala.id,
    isDefault: false,
    smallGoodsServiceTypeId: smallGoods.id,
    standardServiceTypeId: standard.id,
    smallGoodsBandIds,
    standardBandIds,
    smallGoodsPrices: QLD_SMALL_GOODS,
    standardPrices: QLD_STANDARD,
  });

  await seedRateCard({
    name: "Koala Living QLD Deluxe",
    state: "QLD",
    organisationId: koala.id,
    isDefault: false,
    smallGoodsServiceTypeId: smallGoods.id,
    standardServiceTypeId: standard.id,
    smallGoodsBandIds,
    standardBandIds,
    smallGoodsPrices: QLD_DELUXE_SMALL_GOODS,
    standardPrices: QLD_DELUXE_STANDARD,
  });

  // General (non-Koala) state-default cards for VIC/NSW, same pattern as
  // the existing QLD defaults — useful groundwork independent of Koala.
  await seedRateCard({
    name: "VIC New Standard",
    state: "VIC",
    isDefault: true,
    smallGoodsServiceTypeId: smallGoods.id,
    standardServiceTypeId: standard.id,
    smallGoodsBandIds,
    standardBandIds,
    smallGoodsPrices: VIC_SMALL_GOODS,
    standardPrices: VIC_STANDARD,
  });
  await seedRateCard({
    name: "VIC New Deluxe",
    state: "VIC",
    isDefault: false,
    smallGoodsServiceTypeId: smallGoods.id,
    standardServiceTypeId: standard.id,
    smallGoodsBandIds,
    standardBandIds,
    smallGoodsPrices: VIC_DELUXE_SMALL_GOODS,
    standardPrices: VIC_DELUXE_STANDARD,
  });
  await seedRateCard({
    name: "NSW New Standard",
    state: "NSW",
    isDefault: true,
    smallGoodsServiceTypeId: smallGoods.id,
    standardServiceTypeId: standard.id,
    smallGoodsBandIds,
    standardBandIds,
    smallGoodsPrices: NSW_SMALL_GOODS,
    standardPrices: NSW_STANDARD,
  });
  await seedRateCard({
    name: "NSW New Deluxe",
    state: "NSW",
    isDefault: false,
    smallGoodsServiceTypeId: smallGoods.id,
    standardServiceTypeId: standard.id,
    smallGoodsBandIds,
    standardBandIds,
    smallGoodsPrices: NSW_DELUXE_SMALL_GOODS,
    standardPrices: NSW_DELUXE_STANDARD,
  });

  // Koala's three delivery zones — codes only. No postcodes are seeded
  // because Koala's official postcode/zone list has not been supplied yet;
  // an admin enters the real list under Admin -> Pricing -> Delivery Zones
  // once it's available (needsConfirmation stays true until then, and
  // lib/pricing/koala.ts refuses to price a postcode with no zone match
  // rather than guessing one).
  const zones = [
    { code: KOALA_ZONE_CODES.A, name: "Koala Zone A (~55km from warehouse)" },
    { code: KOALA_ZONE_CODES.B, name: "Koala Zone B (~100km from warehouse)" },
    { code: KOALA_ZONE_CODES.REGIONAL, name: "Koala Regional QLD" },
  ];
  for (const z of zones) {
    await prisma.deliveryZone.upsert({
      where: { code: z.code },
      update: {},
      create: {
        code: z.code,
        name: z.name,
        state: "QLD",
        postcodes: null,
        adjustmentModel: "NONE",
        needsConfirmation: true,
        notes: "Awaiting Koala's official postcode/zone list — do not price against this zone until postcodes are entered.",
      },
    });
  }

  // Fixed (not CBM-based) Koala charges — amounts not supplied, left null
  // and flagged, per "do not guess missing commercial rules."
  const fixedExtras = [
    { code: "KOALA_RETURN", label: "Koala Return (fixed)" },
    { code: "KOALA_LATE_CANCELLATION", label: "Koala Late Cancellation (fixed)" },
    { code: "KOALA_FUTILE_DELIVERY", label: "Koala Futile Delivery (fixed)" },
  ];
  for (const e of fixedExtras) {
    await prisma.pricingExtra.upsert({
      where: { code: e.code },
      update: {},
      create: { code: e.code, label: e.label, amountType: "FIXED", amount: null, needsConfirmation: true },
    });
  }

  console.log("Koala Living pricing seeded: Koala Living QLD Standard + Deluxe rate cards, VIC/NSW general defaults.");
  console.log("Needs Koala data before it's usable: postcode/zone mapping (3 zone shells created, no postcodes), and KOALA_RETURN / KOALA_LATE_CANCELLATION / KOALA_FUTILE_DELIVERY fixed amounts.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
