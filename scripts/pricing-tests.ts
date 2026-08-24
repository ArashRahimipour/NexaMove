// Automated validation for the pricing engine, per the exact worked
// examples supplied. Run with: npm run test:pricing (requires DATABASE_URL
// pointing at a database that has been seeded via `npm run db:seed:pricing`).
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { computeFuelLevy, computeGst, computeQuote, resolveCbmBand, round2 } from "../lib/pricing/engine";

const prisma = new PrismaClient();
let failures = 0;

function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (err) {
      failures++;
      console.log(`FAIL  ${name}`);
      console.log(`      ${err instanceof Error ? err.message : err}`);
    }
  })();
}

async function main() {
  console.log("Pricing engine tests\n");

  await check("Fuel levy: 390.91 x 10.65% = 41.63", () => {
    assert.equal(computeFuelLevy(390.91, 10.65), 41.63);
  });
  await check("Fuel levy: 213.63 x 10.65% = 22.75", () => {
    assert.equal(computeFuelLevy(213.63, 10.65), 22.75);
  });
  await check("Fuel levy: 100.00 x 10.65% = 10.65", () => {
    assert.equal(computeFuelLevy(100.0, 10.65), 10.65);
  });

  await check("GST: (390.91 + 41.63) x 10% = 43.25", () => {
    const subtotal = round2(390.91 + 41.63);
    assert.equal(subtotal, 432.54);
    assert.equal(computeGst(subtotal, 10), 43.25);
  });

  await check("Total: 390.91 + 41.63 + 43.25 = 475.79", () => {
    const total = round2(390.91 + 41.63 + 43.25);
    assert.equal(total, 475.79);
  });

  const standardServiceType = await prisma.serviceType.findUniqueOrThrow({ where: { code: "STANDARD" } });

  await check("CBM band: 6.35 -> 6–7 CBM", async () => {
    const band = await resolveCbmBand(standardServiceType.id, 6.35);
    assert.equal(band?.label, "6–7 CBM");
  });

  await check("CBM band boundary: 7.00 deterministically maps to 6–7 CBM (inclusive upper bound)", async () => {
    const band = await resolveCbmBand(standardServiceType.id, 7.0);
    assert.equal(band?.label, "6–7 CBM");
  });

  await check("CBM band boundary: 0.40 maps to first bracket (0–0.4)", async () => {
    const band = await resolveCbmBand(standardServiceType.id, 0.4);
    assert.equal(band?.label, "0–0.4 CBM");
  });

  await check("CBM band boundary: 0.41 maps to second bracket (0.4–0.8)", async () => {
    const band = await resolveCbmBand(standardServiceType.id, 0.41);
    assert.equal(band?.label, "0.4–0.8 CBM");
  });

  await check("CBM band: open-ended top band catches anything above 15", async () => {
    const band = await resolveCbmBand(standardServiceType.id, 42);
    assert.equal(band?.label, "15+ CBM");
  });

  await check("Rate card lookup: QLD New Standard, Standard, 6–7 CBM = $335.50", async () => {
    const quote = await computeQuote({ state: "QLD", destPostcode: "4000", serviceTypeCode: "STANDARD", cbm: 6.3 });
    assert.equal(quote.found, true);
    assert.equal(quote.baseRate, 335.5);
    assert.equal(quote.rateCardName, "QLD New Standard");
  });

  await check("Zone capability: BNE vs GC can produce different rates once configured", async () => {
    const bne = await prisma.deliveryZone.upsert({
      where: { code: "TEST-BNE" },
      update: { adjustmentModel: "FIXED_SURCHARGE", fixedSurcharge: 10, needsConfirmation: false },
      create: { code: "TEST-BNE", name: "Test BNE", state: "QLD", adjustmentModel: "FIXED_SURCHARGE", fixedSurcharge: 10, needsConfirmation: false },
    });
    const gc = await prisma.deliveryZone.upsert({
      where: { code: "TEST-GC" },
      update: { adjustmentModel: "FIXED_SURCHARGE", fixedSurcharge: 25, needsConfirmation: false },
      create: { code: "TEST-GC", name: "Test GC", state: "QLD", adjustmentModel: "FIXED_SURCHARGE", fixedSurcharge: 25, needsConfirmation: false },
    });
    const bneQuote = await computeQuote({ state: "QLD", destPostcode: "4000", zoneCode: bne.code, serviceTypeCode: "STANDARD", cbm: 6.3 });
    const gcQuote = await computeQuote({ state: "QLD", destPostcode: "4200", zoneCode: gc.code, serviceTypeCode: "STANDARD", cbm: 6.3 });
    assert.notEqual(bneQuote.nettCharge, gcQuote.nettCharge);
    assert.equal(bneQuote.nettCharge, round2(335.5 + 10));
    assert.equal(gcQuote.nettCharge, round2(335.5 + 25));
    await prisma.deliveryZone.deleteMany({ where: { code: { in: ["TEST-BNE", "TEST-GC"] } } });
  });

  await check("Client override: a client-specific rate card overrides the generic QLD rate", async () => {
    const org = await prisma.organisation.upsert({
      where: { id: "test-koala-org" },
      update: {},
      create: { id: "test-koala-org", companyName: "Test Koala Living" },
    });
    const smallGoods = await prisma.serviceType.findUniqueOrThrow({ where: { code: "SMALL_GOODS" } });
    const band = await resolveCbmBand(smallGoods.id, 0.3);
    const clientCard = await prisma.rateCard.create({
      data: { name: "Koala Living QLD (test)", state: "QLD", organisationId: org.id, active: true },
    });
    await prisma.rateCardLine.create({
      data: { rateCardId: clientCard.id, serviceTypeId: smallGoods.id, cbmBandId: band!.id, price: 19.99 },
    });

    const genericQuote = await computeQuote({ state: "QLD", destPostcode: "4000", serviceTypeCode: "SMALL_GOODS", cbm: 0.3 });
    const clientQuote = await computeQuote({
      state: "QLD",
      destPostcode: "4000",
      serviceTypeCode: "SMALL_GOODS",
      cbm: 0.3,
      organisationId: org.id,
    });

    assert.equal(genericQuote.rateCardTier, "STATE_DEFAULT");
    assert.equal(clientQuote.rateCardTier, "CLIENT_SPECIFIC");
    assert.equal(clientQuote.baseRate, 19.99);
    assert.notEqual(clientQuote.baseRate, genericQuote.baseRate);

    await prisma.rateCardLine.deleteMany({ where: { rateCardId: clientCard.id } });
    await prisma.rateCard.delete({ where: { id: clientCard.id } });
    await prisma.organisation.delete({ where: { id: org.id } });
  });

  await check("Margin: GST excluded from driver payment and company margin", async () => {
    const quote = await computeQuote({ state: "QLD", destPostcode: "4000", serviceTypeCode: "STANDARD", cbm: 6.3, driverPaymentPercentOverride: 60 });
    assert.equal(quote.driverPayment, round2(quote.nettCharge! * 0.6));
    assert.equal(round2(quote.driverPayment! + quote.companyMargin!), quote.nettCharge);
  });

  console.log(`\n${failures === 0 ? "All tests passed." : `${failures} test(s) FAILED.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
