-- Weekly warehouse driver compliance audit (Koala requirement B.8).

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'WAREHOUSE_AUDIT_CRITICAL_FAIL';

-- CreateEnum
CREATE TYPE "WarehouseAuditCategory" AS ENUM ('COMPANY_UNIFORM', 'VISIBLE_LOGO', 'SAFETY_VEST_PPE', 'SAFETY_SHOES', 'STANDARD_TOOLS', 'FURNITURE_BLANKETS', 'STRAPS_TIE_DOWNS', 'TROLLEY', 'DRILL_TOOLS', 'VACUUM', 'CLEANING_PRODUCTS', 'VEHICLE_CLEANLINESS', 'VEHICLE_CONDITION', 'REQUIRED_DOCUMENTATION');

-- CreateEnum
CREATE TYPE "AuditItemResult" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "warehouse_audits" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "auditorId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_audit_items" (
    "id" TEXT NOT NULL,
    "warehouseAuditId" TEXT NOT NULL,
    "category" "WarehouseAuditCategory" NOT NULL,
    "result" "AuditItemResult" NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "correctiveAction" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "warehouse_audit_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouse_audits_driverId_idx" ON "warehouse_audits"("driverId");

-- CreateIndex
CREATE INDEX "warehouse_audits_auditedAt_idx" ON "warehouse_audits"("auditedAt");

-- AddForeignKey
ALTER TABLE "warehouse_audits" ADD CONSTRAINT "warehouse_audits_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_audits" ADD CONSTRAINT "warehouse_audits_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_audits" ADD CONSTRAINT "warehouse_audits_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_audits" ADD CONSTRAINT "warehouse_audits_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_audit_items" ADD CONSTRAINT "warehouse_audit_items_warehouseAuditId_fkey" FOREIGN KEY ("warehouseAuditId") REFERENCES "warehouse_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
