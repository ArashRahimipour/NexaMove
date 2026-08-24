import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { computeReturnSlaBand } from "@/lib/returns";
import type { AlertType } from "@prisma/client";

// Scans open return tasks and raises/keeps Alert rows for anything crossing
// the 24h-remaining or 48h-overdue thresholds. Idempotent — re-running it
// doesn't create duplicate alerts for a task that's already flagged at that
// level. There's no background scheduler in this codebase yet, so this is
// wired as an authenticated action (the "Refresh SLA alerts" button on
// /admin/returns) rather than a real cron job; once this app has a
// deployment target with a scheduler (e.g. Vercel Cron), pointing it at
// this route on an hourly interval is the remaining piece — not invented
// here since no host has been chosen yet (see docs/DEPLOYMENT.md).
const BAND_TO_ALERT_TYPE: Record<"WARNING" | "OVERDUE", AlertType> = {
  WARNING: "RETURN_SLA_WARNING_24H",
  OVERDUE: "RETURN_SLA_OVERDUE",
};

export async function POST() {
  const auth = await requireRole("ADMIN", "OPERATIONS_MANAGER");
  if (!auth.ok) return auth.response;

  const openTasks = await prisma.returnTask.findMany({
    where: { status: { not: "CLOSED" }, slaDeadline: { not: null } },
    include: { delivery: { select: { id: true, customerName: true, trackingCode: true } } },
  });

  let created = 0;
  for (const task of openTasks) {
    const band = computeReturnSlaBand({ status: task.status, slaDeadline: task.slaDeadline });
    if (band !== "WARNING" && band !== "OVERDUE") continue;

    const alertType = BAND_TO_ALERT_TYPE[band];
    const existingOpenAlert = await prisma.alert.findFirst({
      where: { type: alertType, deliveryId: task.deliveryId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    });
    if (existingOpenAlert) continue;

    await prisma.alert.create({
      data: {
        type: alertType,
        deliveryId: task.deliveryId,
        message:
          band === "OVERDUE"
            ? `Return overdue for ${task.delivery.customerName} (${task.delivery.trackingCode}) — goods not yet scanned in at the warehouse past the 48-hour SLA.`
            : `Return approaching its 48-hour SLA for ${task.delivery.customerName} (${task.delivery.trackingCode}) — under 24 hours remaining.`,
      },
    });
    created++;
  }

  return NextResponse.json({ checked: openTasks.length, alertsCreated: created });
}
