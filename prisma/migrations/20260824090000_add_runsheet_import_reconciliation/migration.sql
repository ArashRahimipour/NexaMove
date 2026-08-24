-- CreateTable
CREATE TABLE "runsheet_imports" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "source" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL,
    "matchedRows" INTEGER NOT NULL,
    "unmatchedRows" INTEGER NOT NULL,

    CONSTRAINT "runsheet_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runsheet_rows" (
    "id" TEXT NOT NULL,
    "runsheetImportId" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "externalReference" TEXT,
    "matchType" TEXT,
    "deliveryId" TEXT,
    "portalStatus" TEXT,
    "portalAmount" DOUBLE PRECISION,
    "scheduledDate" DATE,
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "varianceAmount" DOUBLE PRECISION,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runsheet_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runsheet_imports_organisationId_importedAt_idx" ON "runsheet_imports"("organisationId", "importedAt");

-- CreateIndex
CREATE INDEX "runsheet_rows_runsheetImportId_idx" ON "runsheet_rows"("runsheetImportId");

-- CreateIndex
CREATE INDEX "runsheet_rows_deliveryId_idx" ON "runsheet_rows"("deliveryId");

-- CreateIndex
CREATE INDEX "runsheet_rows_reconciliationStatus_idx" ON "runsheet_rows"("reconciliationStatus");

-- AddForeignKey
ALTER TABLE "runsheet_imports" ADD CONSTRAINT "runsheet_imports_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runsheet_imports" ADD CONSTRAINT "runsheet_imports_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runsheet_rows" ADD CONSTRAINT "runsheet_rows_runsheetImportId_fkey" FOREIGN KEY ("runsheetImportId") REFERENCES "runsheet_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runsheet_rows" ADD CONSTRAINT "runsheet_rows_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runsheet_rows" ADD CONSTRAINT "runsheet_rows_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
