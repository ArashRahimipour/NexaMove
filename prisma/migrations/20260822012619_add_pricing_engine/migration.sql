-- CreateEnum
CREATE TYPE "ZoneAdjustmentModel" AS ENUM ('NONE', 'FIXED_TABLE', 'FIXED_SURCHARGE', 'MULTIPLIER', 'CLIENT_NEGOTIATED');

-- CreateEnum
CREATE TYPE "ExtraAmountType" AS ENUM ('FIXED', 'PER_HOUR', 'PER_CBM');

-- CreateTable
CREATE TABLE "service_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbm_bands" (
    "id" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "minCbm" DOUBLE PRECISION NOT NULL,
    "maxCbm" DOUBLE PRECISION,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "cbm_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "organisationId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_card_lines" (
    "id" TEXT NOT NULL,
    "rateCardId" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "cbmBandId" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "needsConfirmation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rate_card_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postcodes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "adjustmentModel" "ZoneAdjustmentModel" NOT NULL DEFAULT 'NONE',
    "fixedSurcharge" DOUBLE PRECISION,
    "multiplier" DOUBLE PRECISION,
    "minimumCharge" DOUBLE PRECISION,
    "overrideRateCardId" TEXT,
    "needsConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_levies" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "state" TEXT,
    "rateCardId" TEXT,
    "percentage" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_levies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_extras" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountType" "ExtraAmountType" NOT NULL DEFAULT 'FIXED',
    "amount" DOUBLE PRECISION,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "needsConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_service_code_mappings" (
    "id" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "serviceTypeId" TEXT,
    "suggestedLabel" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_service_code_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_quotes" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "organisationId" TEXT,
    "deliveryId" TEXT,
    "state" TEXT NOT NULL,
    "originPostcode" TEXT,
    "destPostcode" TEXT NOT NULL,
    "zoneId" TEXT,
    "serviceTypeId" TEXT NOT NULL,
    "cbmBandId" TEXT,
    "cbm" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION,
    "quantity" INTEGER,
    "assemblyRequired" BOOLEAN NOT NULL DEFAULT false,
    "stairs" BOOLEAN NOT NULL DEFAULT false,
    "additionalLabourHours" DOUBLE PRECISION,
    "otherSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseRate" DOUBLE PRECISION NOT NULL,
    "zoneAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assemblyCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherExtras" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nettCharge" DOUBLE PRECISION NOT NULL,
    "fuelLevyPercentage" DOUBLE PRECISION NOT NULL,
    "fuelLevyAmount" DOUBLE PRECISION NOT NULL,
    "gstPercentage" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "rateCardId" TEXT,
    "rateCardNameSnapshot" TEXT NOT NULL,
    "ruleIdSnapshot" TEXT NOT NULL,
    "driverPaymentPercent" DOUBLE PRECISION NOT NULL,
    "driverPayment" DOUBLE PRECISION NOT NULL,
    "companyMargin" DOUBLE PRECISION NOT NULL,
    "currentCarrierPrice" DOUBLE PRECISION,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_types_code_key" ON "service_types"("code");

-- CreateIndex
CREATE INDEX "cbm_bands_serviceTypeId_sortOrder_idx" ON "cbm_bands"("serviceTypeId", "sortOrder");

-- CreateIndex
CREATE INDEX "rate_cards_state_idx" ON "rate_cards"("state");

-- CreateIndex
CREATE INDEX "rate_cards_organisationId_idx" ON "rate_cards"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "rate_card_lines_rateCardId_serviceTypeId_cbmBandId_key" ON "rate_card_lines"("rateCardId", "serviceTypeId", "cbmBandId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_code_key" ON "delivery_zones"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_extras_code_key" ON "pricing_extras"("code");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_service_code_mappings_sourceCode_key" ON "carrier_service_code_mappings"("sourceCode");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_quotes_quoteNumber_key" ON "pricing_quotes"("quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_quotes_deliveryId_key" ON "pricing_quotes"("deliveryId");

-- AddForeignKey
ALTER TABLE "cbm_bands" ADD CONSTRAINT "cbm_bands_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_card_lines" ADD CONSTRAINT "rate_card_lines_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "rate_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_card_lines" ADD CONSTRAINT "rate_card_lines_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_card_lines" ADD CONSTRAINT "rate_card_lines_cbmBandId_fkey" FOREIGN KEY ("cbmBandId") REFERENCES "cbm_bands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_overrideRateCardId_fkey" FOREIGN KEY ("overrideRateCardId") REFERENCES "rate_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_levies" ADD CONSTRAINT "fuel_levies_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_levies" ADD CONSTRAINT "fuel_levies_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "rate_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_levies" ADD CONSTRAINT "fuel_levies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_service_code_mappings" ADD CONSTRAINT "carrier_service_code_mappings_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "service_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_service_code_mappings" ADD CONSTRAINT "carrier_service_code_mappings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quotes" ADD CONSTRAINT "pricing_quotes_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quotes" ADD CONSTRAINT "pricing_quotes_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quotes" ADD CONSTRAINT "pricing_quotes_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quotes" ADD CONSTRAINT "pricing_quotes_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quotes" ADD CONSTRAINT "pricing_quotes_cbmBandId_fkey" FOREIGN KEY ("cbmBandId") REFERENCES "cbm_bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quotes" ADD CONSTRAINT "pricing_quotes_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "rate_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quotes" ADD CONSTRAINT "pricing_quotes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
