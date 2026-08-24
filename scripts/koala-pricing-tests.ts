// Validation for Koala Living's pricing composition, per the exact figures
// supplied in "rate_card_comparision.xlsx" and the precedence rules in
// Koala's brief. Run with: npm run test:koala-pricing (requires
// DATABASE_URL pointing at a database seeded via `npm run db:seed:pricing`
// then `npm run db:seed:koala`).
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { computeKoalaQuote, resolveKoalaCategory, KOALA_ORG_NAME, KOALA_ZONE_CODES } from "../lib/pricing/koala";

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
  console.log("Koala Living pricing tests\n");

  // --- Pure category-resolution logic (no DB needed) ---
  await check("Zone A, 0.4 CBM -> Small Goods (upper-inclusive boundary)", () => {
    assert.equal(resolveKoalaCategory(KOALA_ZONE_CODES.A, 0.4), "SMALL_GOODS");
  });
  await check("Zone A, 0.8 CBM -> Small Goods (upper-inclusive boundary)", () => {
    assert.equal(resolveKoalaCategory(KOALA_ZONE_CODES.A, 0.8), "SMALL_GOODS");
  });
  await check("Zone A, 0.81 CBM -> Standard (Small Goods precedence rule: >0.8 in Zone A is always Standard)", () => {
    assert.equal(resolveKoalaCategory(KOALA_ZONE_CODES.A, 0.81), "STANDARD");
  });
  await check("Zone A, 6 CBM -> Standard", () => {
    assert.equal(resolveKoalaCategory(KOALA_ZONE_CODES.A, 6), "STANDARD");
  });
  await check("Zone B, 0.3 CBM -> Standard irrespective of CBM (never Small Goods outside Zone A)", () => {
    assert.equal(resolveKoalaCategory(KOALA_ZONE_CODES.B, 0.3), "STANDARD");
  });
  await check("Regional, 0.2 CBM -> Standard irrespective of CBM", () => {
    assert.equal(resolveKoalaCategory(KOALA_ZONE_CODES.REGIONAL, 0.2), "STANDARD");
  });

  // --- DB-backed: needs seed-pricing + seed-koala-pricing run first ---
  const koala = await prisma.organisation.findFirst({ where: { companyName: KOALA_ORG_NAME } });
  if (!koala) {
    console.log("\nSkipping DB-backed checks: Koala organisation not found — run `npm run db:seed:koala` first.");
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  }

  await check("Unmapped postcode is refused, not guessed", async () => {
    const result = await computeKoalaQuote({ organisationId: koala!.id, postcode: "9999", cbm: 1 });
    assert.equal(result.found, false);
    assert.match(result.reason ?? "", /not mapped to a Koala zone/);
  });

  // The remaining checks require a real Zone A postcode to be entered under
  // Admin -> Pricing -> Delivery Zones (KOALA-ZONE-A) — until Koala's
  // official list is supplied there is nothing to test end-to-end here,
  // which is the correct (refuse-to-guess) behaviour, not a gap in this
  // test file.
  const zoneA = await prisma.deliveryZone.findUnique({ where: { code: KOALA_ZONE_CODES.A } });
  const testPostcode = zoneA?.postcodes?.split(",")[0]?.trim();
  if (!testPostcode) {
    console.log("\nSkipping Zone A price checks: no postcode configured yet for KOALA-ZONE-A.");
  } else {
    await check(`Zone A / 0.3 CBM at ${testPostcode} -> Small Goods $27.50`, async () => {
      const result = await computeKoalaQuote({ organisationId: koala!.id, postcode: testPostcode, cbm: 0.3 });
      assert.equal(result.found, true);
      assert.equal(result.category, "SMALL_GOODS");
      assert.equal(result.expressRate, 27.5);
    });
    await check(`Zone A / 6.3 CBM at ${testPostcode} -> Standard $335.50`, async () => {
      const result = await computeKoalaQuote({ organisationId: koala!.id, postcode: testPostcode, cbm: 6.3 });
      assert.equal(result.found, true);
      assert.equal(result.category, "STANDARD");
      assert.equal(result.expressRate, 335.5);
    });
    await check(`Zone A / 6.3 CBM + Deluxe at ${testPostcode} -> Express + Deluxe, never a replacement`, async () => {
      const result = await computeKoalaQuote({ organisationId: koala!.id, postcode: testPostcode, cbm: 6.3, deluxe: true });
      assert.equal(result.found, true);
      assert.equal(result.expressRate, 335.5);
      assert.equal(result.deluxeCharge, 247.5);
      assert.equal(result.exGstTotal, 583.0);
      assert.equal(result.finalCustomerCharge, Math.round((583 * 1.1 + Number.EPSILON) * 100) / 100);
    });
  }

  console.log(`\n${failures === 0 ? "All tests passed." : `${failures} test(s) FAILED.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
