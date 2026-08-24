// DB-level integrity checks for mechanisms that only a real database can
// actually verify — a compound-unique upsert, a partial unique index, a
// nested create — as opposed to lib/pricing/*-tests.ts, which check
// business-logic correctness. Run with: npm run test:schema-integrity
// (requires DATABASE_URL pointing at a migrated + seeded database).
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Schema integrity tests (live database)\n");

  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const driver = await prisma.user.upsert({
    where: { email: "verify-driver@nexamove.local" },
    update: {},
    create: { email: "verify-driver@nexamove.local", passwordHash: await bcrypt.hash("x", 4), name: "Verify Driver", role: "DRIVER" },
  });
  const vehicle = await prisma.vehicle.upsert({
    where: { registration: "VERIFY-1" },
    update: {},
    create: { registration: "VERIFY-1", type: "Van" },
  });
  const route = await prisma.route.create({
    data: { name: "Verify route", date: new Date(), driverId: driver.id, vehicleId: vehicle.id, createdById: admin.id },
  });
  const delivery = await prisma.delivery.create({
    data: {
      customerName: "Verify Customer",
      address: "1 Test St",
      suburb: "Testville",
      postcode: "4000",
      routeId: route.id,
      sequence: 0,
      status: "ASSIGNED",
      createdById: admin.id,
    },
  });

  // --- DispatchScan: partial unique index really rejects a second SCANNED row ---
  await prisma.dispatchScan.create({
    data: { scannedCode: delivery.trackingCode, deliveryId: delivery.id, routeId: route.id, scannedById: driver.id, outcome: "SCANNED" },
  });
  let duplicateRejected = false;
  try {
    await prisma.dispatchScan.create({
      data: { scannedCode: delivery.trackingCode, deliveryId: delivery.id, routeId: route.id, scannedById: driver.id, outcome: "SCANNED" },
    });
  } catch (err) {
    duplicateRejected = err instanceof Error && /unique/i.test(err.message);
  }
  assert.equal(duplicateRejected, true, "DB-level partial unique index should reject a second SCANNED row for the same delivery");
  console.log("  ok  DispatchScan partial unique index rejects a duplicate SCANNED row at the DB level");

  const scanCount = await prisma.dispatchScan.count({ where: { deliveryId: delivery.id } });
  assert.equal(scanCount, 1);
  console.log("  ok  Exactly one DispatchScan row persisted");

  // --- ReturnTask: nested item create + SLA fields ---
  const returnTask = await prisma.returnTask.create({
    data: {
      deliveryId: delivery.id,
      driverId: driver.id,
      status: "DRIVER_POSSESSION",
      collectedAt: new Date(),
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      createdById: admin.id,
      items: { create: [{ description: "Old sofa", quantity: 1 }] },
    },
    include: { items: true },
  });
  assert.equal(returnTask.items.length, 1);
  console.log("  ok  ReturnTask + nested ReturnTaskItem created");

  // --- ServicingSchedule: compound-unique (organisationId, region="") upsert ---
  const org = await prisma.organisation.upsert({
    where: { id: "verify-org" },
    update: {},
    create: { id: "verify-org", companyName: "Verify Org" },
  });
  const schedule = await prisma.servicingSchedule.upsert({
    where: { organisationId_region: { organisationId: org.id, region: "" } },
    update: { daysOfWeek: [2, 3, 4, 5, 6] },
    create: { organisationId: org.id, region: "", daysOfWeek: [2, 3, 4, 5, 6] },
  });
  assert.deepEqual(schedule.daysOfWeek, [2, 3, 4, 5, 6]);
  // Upsert again to prove it updates the SAME row rather than colliding/erroring
  const schedule2 = await prisma.servicingSchedule.upsert({
    where: { organisationId_region: { organisationId: org.id, region: "" } },
    update: { notes: "updated" },
    create: { organisationId: org.id, region: "", daysOfWeek: [1] },
  });
  assert.equal(schedule2.id, schedule.id);
  assert.equal(schedule2.notes, "updated");
  console.log("  ok  ServicingSchedule compound-unique (organisationId, region=\"\") upsert targets the same row twice");

  // --- WarehouseAudit: nested items + critical-fail shape ---
  const audit = await prisma.warehouseAudit.create({
    data: {
      driverId: driver.id,
      vehicleId: vehicle.id,
      auditorId: admin.id,
      items: {
        create: [
          { category: "SAFETY_VEST_PPE", result: "FAIL", critical: true, correctiveAction: "Issue new vest" },
          { category: "COMPANY_UNIFORM", result: "PASS" },
        ],
      },
    },
    include: { items: true },
  });
  assert.equal(audit.items.length, 2);
  const alert = await prisma.alert.create({
    data: { type: "WAREHOUSE_AUDIT_CRITICAL_FAIL", driverId: driver.id, message: "Verify critical fail alert" },
  });
  assert.ok(alert.id);
  console.log("  ok  WarehouseAudit + nested items + WAREHOUSE_AUDIT_CRITICAL_FAIL alert created");

  // --- MorningCommunicationLog ---
  const log = await prisma.morningCommunicationLog.create({
    data: {
      date: new Date(),
      issueType: "OVERNIGHT_EXCEPTION",
      description: "Verify log entry",
      createdById: admin.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
    },
  });
  assert.ok(log.id);
  console.log("  ok  MorningCommunicationLog created");

  // --- Koala pricing: re-confirm via a direct import of the engine module.
  // Sets a throwaway postcode on KOALA-ZONE-A for the duration of this
  // check (restored in cleanup below) rather than depending on whatever a
  // previous run or an admin may have already configured. ---
  const { computeKoalaQuote, KOALA_ORG_NAME, KOALA_ZONE_CODES } = await import("../lib/pricing/koala");
  const koala = await prisma.organisation.findFirstOrThrow({ where: { companyName: KOALA_ORG_NAME } });
  const zoneA = await prisma.deliveryZone.findUniqueOrThrow({ where: { code: KOALA_ZONE_CODES.A } });
  const originalZoneAPostcodes = zoneA.postcodes;
  await prisma.deliveryZone.update({ where: { id: zoneA.id }, data: { postcodes: "9999" } });

  const unmapped = await computeKoalaQuote({ organisationId: koala.id, postcode: "4000", cbm: 6.3 });
  assert.equal(unmapped.found, false, "an unmapped postcode must be refused, never guessed");
  console.log("  ok  computeKoalaQuote refuses an unmapped postcode rather than guessing a zone");

  const quote = await computeKoalaQuote({ organisationId: koala.id, postcode: "9999", cbm: 6.3, deluxe: true });
  assert.equal(quote.found, true);
  assert.equal(quote.finalCustomerCharge, 641.3);
  console.log("  ok  computeKoalaQuote end-to-end via direct import: $641.30 (Express $335.50 + Deluxe $247.50, GST-inclusive)");

  await prisma.deliveryZone.update({ where: { id: zoneA.id }, data: { postcodes: originalZoneAPostcodes } });

  // Cleanup this script's throwaway data
  await prisma.dispatchScan.deleteMany({ where: { deliveryId: delivery.id } });
  await prisma.returnTaskItem.deleteMany({ where: { returnTaskId: returnTask.id } });
  await prisma.returnTask.delete({ where: { id: returnTask.id } });
  await prisma.warehouseAuditItem.deleteMany({ where: { warehouseAuditId: audit.id } });
  await prisma.warehouseAudit.delete({ where: { id: audit.id } });
  await prisma.alert.delete({ where: { id: alert.id } });
  await prisma.morningCommunicationLog.delete({ where: { id: log.id } });
  await prisma.servicingSchedule.delete({ where: { id: schedule.id } });
  await prisma.delivery.delete({ where: { id: delivery.id } });
  await prisma.route.delete({ where: { id: route.id } });
  await prisma.organisation.delete({ where: { id: org.id } });
  await prisma.vehicle.delete({ where: { id: vehicle.id } });
  await prisma.user.delete({ where: { id: driver.id } });

  console.log("\nAll live-DB checks passed. Throwaway verification data cleaned up.");
}

main()
  .catch((err) => {
    console.error("FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
