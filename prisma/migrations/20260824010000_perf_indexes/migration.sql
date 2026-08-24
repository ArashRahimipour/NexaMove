-- Performance audit (2026-08-24): add indexes for query patterns that were
-- doing full-table or full-partition scans in production —
--   * admin dashboard / KPI: Route.date range scan (no driverId filter)
--   * admin dashboard / KPI: Delivery.createdAt range scan
--   * dispatch: Delivery.routeId IS NULL + status IN (...)
--   * client portal / admin: Delivery.organisationId + status
--   * scheduling/reporting: Delivery.deliveryDate
-- All additive (CREATE INDEX), no data migration, safe to run against a live
-- database with no downtime.

-- CreateIndex
CREATE INDEX "routes_date_idx" ON "routes"("date");

-- CreateIndex
CREATE INDEX "deliveries_organisationId_status_idx" ON "deliveries"("organisationId", "status");

-- CreateIndex
CREATE INDEX "deliveries_routeId_idx" ON "deliveries"("routeId");

-- CreateIndex
CREATE INDEX "deliveries_deliveryDate_idx" ON "deliveries"("deliveryDate");

-- CreateIndex
CREATE INDEX "deliveries_createdAt_idx" ON "deliveries"("createdAt");
