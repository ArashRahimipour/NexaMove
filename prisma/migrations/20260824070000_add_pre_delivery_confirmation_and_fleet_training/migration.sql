-- CreateEnum
CREATE TYPE "ClientTrainingType" AS ENUM ('INDUCTION', 'PRODUCT_HANDLING', 'ASSEMBLY', 'CUSTOMER_SERVICE');

-- CreateEnum
CREATE TYPE "PreDeliveryConfirmationStatus" AS ENUM ('NOT_CONTACTED', 'CONTACT_ATTEMPTED', 'CONFIRMED', 'UNABLE_TO_CONTACT', 'DETAILS_CHANGED');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('PHONE', 'SMS', 'EMAIL', 'IN_PERSON', 'OTHER');

-- CreateTable
CREATE TABLE "client_driver_approvals" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "dedicated" BOOLEAN NOT NULL DEFAULT false,
    "primaryDriver" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "complianceStatus" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_driver_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_vehicle_approvals" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "dedicated" BOOLEAN NOT NULL DEFAULT false,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_vehicle_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_driver_trainings" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "trainingType" "ClientTrainingType" NOT NULL,
    "completedAt" DATE NOT NULL,
    "expiresAt" DATE,
    "documentUrl" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_driver_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_representative_shifts" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "representativeId" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_representative_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_delivery_confirmations" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "status" "PreDeliveryConfirmationStatus" NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "notes" TEXT,
    "customerResponse" TEXT,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_delivery_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_driver_approvals_organisationId_driverId_key" ON "client_driver_approvals"("organisationId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "client_vehicle_approvals_organisationId_vehicleId_key" ON "client_vehicle_approvals"("organisationId", "vehicleId");

-- CreateIndex
CREATE INDEX "client_driver_trainings_organisationId_driverId_idx" ON "client_driver_trainings"("organisationId", "driverId");

-- CreateIndex
CREATE INDEX "warehouse_representative_shifts_date_idx" ON "warehouse_representative_shifts"("date");

-- CreateIndex
CREATE INDEX "pre_delivery_confirmations_deliveryId_createdAt_idx" ON "pre_delivery_confirmations"("deliveryId", "createdAt");

-- AddForeignKey
ALTER TABLE "client_driver_approvals" ADD CONSTRAINT "client_driver_approvals_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_driver_approvals" ADD CONSTRAINT "client_driver_approvals_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_vehicle_approvals" ADD CONSTRAINT "client_vehicle_approvals_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_vehicle_approvals" ADD CONSTRAINT "client_vehicle_approvals_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_driver_trainings" ADD CONSTRAINT "client_driver_trainings_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_driver_trainings" ADD CONSTRAINT "client_driver_trainings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_driver_trainings" ADD CONSTRAINT "client_driver_trainings_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_representative_shifts" ADD CONSTRAINT "warehouse_representative_shifts_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_representative_shifts" ADD CONSTRAINT "warehouse_representative_shifts_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_representative_shifts" ADD CONSTRAINT "warehouse_representative_shifts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_delivery_confirmations" ADD CONSTRAINT "pre_delivery_confirmations_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_delivery_confirmations" ADD CONSTRAINT "pre_delivery_confirmations_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
