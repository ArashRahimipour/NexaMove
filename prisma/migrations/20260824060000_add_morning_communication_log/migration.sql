-- Morning warehouse communication log (Koala requirement B.13).

-- CreateEnum
CREATE TYPE "MorningCommIssueType" AS ENUM ('WAREHOUSE_ISSUE', 'DELIVERY_INCIDENT', 'DAMAGED_GOODS', 'RETURNED_STOCK', 'ITEMS_RECEIVED', 'MISSING_STOCK', 'OVERNIGHT_EXCEPTION', 'CUSTOMER_COMPLAINT', 'DRIVER_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "MorningCommStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "morning_communication_logs" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "date" DATE NOT NULL,
    "issueType" "MorningCommIssueType" NOT NULL,
    "deliveryId" TEXT,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "description" TEXT NOT NULL,
    "actionRequired" TEXT,
    "responsiblePerson" TEXT,
    "status" "MorningCommStatus" NOT NULL DEFAULT 'OPEN',
    "attachmentUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "morning_communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "morning_communication_logs_date_idx" ON "morning_communication_logs"("date");

-- CreateIndex
CREATE INDEX "morning_communication_logs_status_idx" ON "morning_communication_logs"("status");

-- AddForeignKey
ALTER TABLE "morning_communication_logs" ADD CONSTRAINT "morning_communication_logs_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morning_communication_logs" ADD CONSTRAINT "morning_communication_logs_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morning_communication_logs" ADD CONSTRAINT "morning_communication_logs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morning_communication_logs" ADD CONSTRAINT "morning_communication_logs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morning_communication_logs" ADD CONSTRAINT "morning_communication_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
