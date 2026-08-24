-- Configurable per-client (and per-region) delivery days — see
-- lib/servicing.ts. Nothing hard-coded: a client with no row here is
-- unrestricted, same as today.

-- CreateTable
CREATE TABLE "servicing_schedules" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "daysOfWeek" INTEGER[],
    "minimumOrderThreshold" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicing_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servicing_schedules_organisationId_region_key" ON "servicing_schedules"("organisationId", "region");

-- AddForeignKey
ALTER TABLE "servicing_schedules" ADD CONSTRAINT "servicing_schedules_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
