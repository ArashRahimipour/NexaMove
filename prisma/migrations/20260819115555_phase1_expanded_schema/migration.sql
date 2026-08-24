-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT 'NexaMove',
    "abn" TEXT,
    "contactEmail" TEXT,
    "regions" TEXT NOT NULL DEFAULT 'QLD',
    "geofenceRadiusMetres" INTEGER NOT NULL DEFAULT 300,
    "photoRequiredForDelivery" BOOLEAN NOT NULL DEFAULT true,
    "signatureRequired" BOOLEAN NOT NULL DEFAULT true,
    "defaultDriverSplitPercent" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
