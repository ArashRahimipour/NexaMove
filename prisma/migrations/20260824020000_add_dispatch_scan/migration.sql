-- Dispatch scan integrity (Koala requirement B.9 and general to all
-- clients): a delivery must be physically scanned at warehouse collection
-- before it counts as dispatched — assignment alone must never be enough.
-- Every scan attempt is recorded (success or rejected), and a partial
-- unique index guarantees only one successful scan can ever exist per
-- delivery, enforced by the database itself, not just application code.

-- CreateEnum
CREATE TYPE "DispatchScanOutcome" AS ENUM ('SCANNED', 'NOT_FOUND', 'CANCELLED_ORDER', 'MISSING_FROM_ROUTE', 'WRONG_ROUTE', 'DUPLICATE_SCAN', 'ALREADY_DISPATCHED');

-- CreateTable
CREATE TABLE "dispatch_scans" (
    "id" TEXT NOT NULL,
    "scannedCode" TEXT NOT NULL,
    "deliveryId" TEXT,
    "routeId" TEXT,
    "scannedById" TEXT NOT NULL,
    "warehouse" TEXT,
    "device" TEXT,
    "outcome" "DispatchScanOutcome" NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispatch_scans_deliveryId_idx" ON "dispatch_scans"("deliveryId");

-- CreateIndex
CREATE INDEX "dispatch_scans_routeId_scannedAt_idx" ON "dispatch_scans"("routeId", "scannedAt");

-- CreateIndex: DB-level guarantee that a delivery can only ever have one
-- successful ("SCANNED") scan row, regardless of how many rejected attempts
-- exist for it — not representable as a plain Prisma @@unique since it's
-- conditional on outcome, so it's hand-written here.
CREATE UNIQUE INDEX "dispatch_scans_one_success_per_delivery_idx" ON "dispatch_scans"("deliveryId") WHERE "outcome" = 'SCANNED';

-- AddForeignKey
ALTER TABLE "dispatch_scans" ADD CONSTRAINT "dispatch_scans_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_scans" ADD CONSTRAINT "dispatch_scans_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_scans" ADD CONSTRAINT "dispatch_scans_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
