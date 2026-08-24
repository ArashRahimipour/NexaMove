-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'CUSTOMER_SERVICE', 'DRIVER', 'RETAIL_CLIENT');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('DRAFT', 'PENDING', 'READY_FOR_DISPATCH', 'ASSIGNED', 'LOADED', 'ROUTE_STARTED', 'IN_TRANSIT', 'DRIVER_NEARBY', 'ARRIVED', 'UNLOADING', 'ASSEMBLY_IN_PROGRESS', 'DELIVERED', 'FAILED', 'DAMAGED', 'PARTIALLY_DELIVERED', 'RETURN_REQUIRED', 'RETURNED', 'RESCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TrackingEventType" AS ENUM ('JOB_CREATED', 'DRIVER_ASSIGNED', 'LOADED', 'ROUTE_STARTED', 'EN_ROUTE', 'CUSTOMER_NOTIFIED', 'DRIVER_NEARBY', 'ARRIVED', 'UNLOADING', 'ASSEMBLY_STARTED', 'PHOTO_CAPTURED', 'SIGNATURE_CAPTURED', 'DAMAGE_NOTED', 'DELIVERED', 'FAILED', 'DAMAGED', 'PARTIALLY_DELIVERED', 'RETURNED', 'RESCHEDULED', 'CANCELLED', 'STATUS_OVERRIDE');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'DELIVERED', 'NOT_DELIVERED', 'DAMAGED', 'MISSING', 'REFUSED');

-- CreateEnum
CREATE TYPE "DamageStage" AS ENUM ('BEFORE_LOADING', 'DURING_LOADING', 'IN_VEHICLE', 'DURING_TRANSPORT', 'DURING_UNLOADING', 'DURING_ASSEMBLY', 'AT_CUSTOMER_PROPERTY', 'CUSTOMER_REPORTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DamageReason" AS ENUM ('PRODUCT_ALREADY_DAMAGED', 'WAREHOUSE_HANDLING', 'INCORRECT_LOADING', 'INSUFFICIENT_PROTECTION', 'PRODUCT_MOVEMENT', 'DRIVER_HANDLING', 'OFFSIDER_HANDLING', 'CUSTOMER_ACCESS_ISSUE', 'STAIRS', 'LIFT_RESTRICTION', 'ASSEMBLY_DAMAGE', 'PACKAGING_FAILURE', 'MANUFACTURING_DEFECT', 'UNKNOWN', 'OTHER');

-- CreateEnum
CREATE TYPE "DamageResponsibility" AS ENUM ('UNDETERMINED', 'WAREHOUSE', 'SUPPLIER', 'MANUFACTURING', 'DRIVER', 'OFFSIDER', 'TRANSPORT', 'CUSTOMER', 'PACKAGING', 'OTHER', 'NO_RESPONSIBILITY');

-- CreateEnum
CREATE TYPE "FailureReason" AS ENUM ('CUSTOMER_NOT_HOME', 'CUSTOMER_REFUSED', 'CANNOT_ACCESS_PROPERTY', 'INCORRECT_ADDRESS', 'CUSTOMER_REQUESTED_RESCHEDULE', 'PRODUCT_DAMAGED', 'PRODUCT_MISSING', 'UNSAFE_ACCESS', 'VEHICLE_ACCESS_RESTRICTION', 'OUTSIDE_WINDOW', 'OTHER');

-- CreateEnum
CREATE TYPE "PhotoCategory" AS ENUM ('PRODUCT_DELIVERED', 'PRODUCT_IN_FINAL_LOCATION', 'ASSEMBLY_COMPLETED', 'PACKAGING_REMOVED', 'CUSTOMER_PROPERTY_ACCESS', 'DAMAGE_CLOSEUP', 'DAMAGE_FULL_PRODUCT', 'DAMAGE_PACKAGING', 'DAMAGE_LABEL', 'FAILED_DELIVERY_EVIDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReceiverRelationship" AS ENUM ('CUSTOMER', 'FAMILY_MEMBER', 'STAFF', 'RECEPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'AWAITING_CUSTOMER', 'AWAITING_OPERATIONS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('DELIVERY_DELAYED', 'FAILED_DELIVERY', 'DAMAGE_REPORT', 'LOW_RATING', 'LICENCE_EXPIRY', 'VEHICLE_COMPLIANCE_EXPIRY', 'DRIVER_OFFLINE', 'GEOFENCE_WARNING', 'MISSING_POD', 'ROUTE_LATE', 'CAPACITY_EXCEEDED', 'RETAIL_CLIENT_ISSUE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PAID');

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "abn" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "billingDetails" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'DRIVER',
    "organisationId" TEXT,
    "region" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenceNumber" TEXT,
    "licenceExpiry" DATE,
    "licenceDocumentUrl" TEXT,
    "vehicleId" TEXT,
    "maxCbm" DOUBLE PRECISION,
    "maxWeight" DOUBLE PRECISION,
    "paymentSplitPercent" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "rating" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "maxCbm" DOUBLE PRECISION,
    "maxWeight" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "insuranceExpiry" DATE,
    "registrationExpiry" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "region" TEXT,
    "status" "RouteStatus" NOT NULL DEFAULT 'PLANNED',
    "driverId" TEXT,
    "vehicleId" TEXT,
    "totalStops" INTEGER NOT NULL DEFAULT 0,
    "totalCbm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startTime" TIMESTAMP(3),
    "finishTime" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "routeId" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "trackingCode" TEXT NOT NULL,
    "externalReference" TEXT,
    "organisationId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "address" TEXT NOT NULL,
    "suburb" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QLD',
    "region" TEXT NOT NULL DEFAULT 'QLD',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "deliveryDate" DATE,
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "numberOfBoxes" INTEGER,
    "cbm" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "assemblyRequired" BOOLEAN NOT NULL DEFAULT false,
    "packagingRemovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "specialInstructions" TEXT,
    "vehicleId" TEXT,
    "stopNumber" INTEGER,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "baseCharge" DOUBLE PRECISION,
    "cbmCharge" DOUBLE PRECISION,
    "weightCharge" DOUBLE PRECISION,
    "assemblyCharge" DOUBLE PRECISION,
    "packagingRemovalCharge" DOUBLE PRECISION,
    "stairsCharge" DOUBLE PRECISION,
    "waitingTimeCharge" DOUBLE PRECISION,
    "redeliveryCharge" DOUBLE PRECISION,
    "regionalSurcharge" DOUBLE PRECISION,
    "otherSurcharge" DOUBLE PRECISION,
    "totalCharge" DOUBLE PRECISION,
    "driverPayment" DOUBLE PRECISION,
    "companyRevenue" DOUBLE PRECISION,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "routeStartedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_items" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "sku" TEXT,
    "productDescription" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "boxes" INTEGER,
    "cbm" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "fragile" BOOLEAN NOT NULL DEFAULT false,
    "assemblyRequired" BOOLEAN NOT NULL DEFAULT false,
    "itemStatus" "ItemStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_photos" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" "PhotoCategory" NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "type" "TrackingEventType" NOT NULL,
    "oldStatus" "DeliveryStatus",
    "newStatus" "DeliveryStatus",
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "device" TEXT,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_deliveries" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "signatureUrl" TEXT,
    "receiverName" TEXT,
    "receiverRelationship" "ReceiverRelationship",
    "signatureExceptionReason" TEXT,
    "contactless" BOOLEAN NOT NULL DEFAULT false,
    "assemblyCompleted" BOOLEAN NOT NULL DEFAULT false,
    "packagingRemoved" BOOLEAN NOT NULL DEFAULT false,
    "gpsLat" DOUBLE PRECISION NOT NULL,
    "gpsLng" DOUBLE PRECISION NOT NULL,
    "gpsAccuracyM" DOUBLE PRECISION,
    "geofenceVerified" BOOLEAN,
    "geofenceOverrideReason" TEXT,
    "capturedById" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_of_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damage_reports" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "itemId" TEXT,
    "discoveredStage" "DamageStage" NOT NULL,
    "reason" "DamageReason" NOT NULL,
    "description" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "responsibility" "DamageResponsibility" NOT NULL DEFAULT 'UNDETERMINED',
    "responsibilitySetById" TEXT,
    "responsibilitySetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "damage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_delivery_reports" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "reason" "FailureReason" NOT NULL,
    "notes" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "photoUrl" TEXT,
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_delivery_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_service_cases" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_service_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_notes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "deliveryId" TEXT,
    "driverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_ratings" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "driverRating" INTEGER,
    "communicationRating" INTEGER,
    "careRating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "driverShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "companyShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_userId_key" ON "drivers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_registration_key" ON "vehicles"("registration");

-- CreateIndex
CREATE INDEX "routes_driverId_date_idx" ON "routes"("driverId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_trackingCode_key" ON "deliveries"("trackingCode");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "deliveries_trackingCode_idx" ON "deliveries"("trackingCode");

-- CreateIndex
CREATE INDEX "deliveries_organisationId_idx" ON "deliveries"("organisationId");

-- CreateIndex
CREATE INDEX "delivery_photos_deliveryId_idx" ON "delivery_photos"("deliveryId");

-- CreateIndex
CREATE INDEX "tracking_events_deliveryId_createdAt_idx" ON "tracking_events"("deliveryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "proof_of_deliveries_deliveryId_key" ON "proof_of_deliveries"("deliveryId");

-- CreateIndex
CREATE INDEX "damage_reports_deliveryId_idx" ON "damage_reports"("deliveryId");

-- CreateIndex
CREATE INDEX "failed_delivery_reports_deliveryId_idx" ON "failed_delivery_reports"("deliveryId");

-- CreateIndex
CREATE INDEX "customer_service_cases_deliveryId_idx" ON "customer_service_cases"("deliveryId");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_ratings_deliveryId_key" ON "customer_ratings"("deliveryId");

-- CreateIndex
CREATE INDEX "audit_logs_recordType_recordId_idx" ON "audit_logs"("recordType", "recordId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "settlements_driverId_periodStart_idx" ON "settlements"("driverId", "periodStart");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_photos" ADD CONSTRAINT "delivery_photos_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_photos" ADD CONSTRAINT "delivery_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "proof_of_deliveries_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "proof_of_deliveries_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_responsibilitySetById_fkey" FOREIGN KEY ("responsibilitySetById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_delivery_reports" ADD CONSTRAINT "failed_delivery_reports_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_delivery_reports" ADD CONSTRAINT "failed_delivery_reports_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_service_cases" ADD CONSTRAINT "customer_service_cases_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_service_cases" ADD CONSTRAINT "customer_service_cases_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "customer_service_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ratings" ADD CONSTRAINT "customer_ratings_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
