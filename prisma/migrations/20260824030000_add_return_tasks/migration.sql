-- 48-hour returns/exchange SLA workflow: Customer Collection -> Driver
-- Possession -> In Transit to Warehouse -> Warehouse Returned -> Scanned In
-- -> Closed, with dashboard-visible SLA alerts.

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'RETURN_SLA_WARNING_24H';
ALTER TYPE "AlertType" ADD VALUE 'RETURN_SLA_APPROACHING_48H';
ALTER TYPE "AlertType" ADD VALUE 'RETURN_SLA_OVERDUE';

-- CreateEnum
CREATE TYPE "ReturnTaskStatus" AS ENUM ('CUSTOMER_COLLECTION', 'DRIVER_POSSESSION', 'IN_TRANSIT_TO_WAREHOUSE', 'WAREHOUSE_RETURNED', 'SCANNED_IN', 'CLOSED');

-- CreateTable
CREATE TABLE "return_tasks" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "status" "ReturnTaskStatus" NOT NULL DEFAULT 'CUSTOMER_COLLECTION',
    "driverId" TEXT,
    "collectedAt" TIMESTAMP(3),
    "slaDeadline" TIMESTAMP(3),
    "inTransitAt" TIMESTAMP(3),
    "warehouseReturnedAt" TIMESTAMP(3),
    "scannedInAt" TIMESTAMP(3),
    "scannedInById" TEXT,
    "closedAt" TIMESTAMP(3),
    "warehouse" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_task_items" (
    "id" TEXT NOT NULL,
    "returnTaskId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT,

    CONSTRAINT "return_task_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "return_tasks_deliveryId_idx" ON "return_tasks"("deliveryId");

-- CreateIndex
CREATE INDEX "return_tasks_status_idx" ON "return_tasks"("status");

-- CreateIndex
CREATE INDEX "return_tasks_slaDeadline_idx" ON "return_tasks"("slaDeadline");

-- AddForeignKey
ALTER TABLE "return_tasks" ADD CONSTRAINT "return_tasks_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_tasks" ADD CONSTRAINT "return_tasks_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_tasks" ADD CONSTRAINT "return_tasks_scannedInById_fkey" FOREIGN KEY ("scannedInById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_tasks" ADD CONSTRAINT "return_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_task_items" ADD CONSTRAINT "return_task_items_returnTaskId_fkey" FOREIGN KEY ("returnTaskId") REFERENCES "return_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
