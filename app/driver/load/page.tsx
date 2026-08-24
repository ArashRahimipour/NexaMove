import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DispatchScanner } from "@/components/DispatchScanner";

// Warehouse collection step, between assignment and starting the route —
// see /driver for the per-stop workflow that follows once loading is done.
export default async function DriverLoadPage() {
  const session = await auth();
  if (!session || session.user.role !== "DRIVER") redirect("/login");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const route = await prisma.route.findFirst({
    where: { driverId: session.user.id, date: { gte: today, lt: tomorrow } },
    include: {
      deliveries: {
        where: { status: { notIn: ["CANCELLED"] } },
        orderBy: { sequence: "asc" },
        select: { id: true, customerName: true, suburb: true, status: true },
      },
    },
  });

  if (!route) {
    return (
      <div className="min-h-screen p-4">
        <div className="card text-center text-dim">No route is assigned to you for today. Check with your dispatcher.</div>
      </div>
    );
  }

  const scans = await prisma.dispatchScan.findMany({
    where: { routeId: route.id, outcome: "SCANNED" },
    select: { deliveryId: true },
  });
  const scannedIds = new Set(scans.map((s) => s.deliveryId).filter((id): id is string => Boolean(id)));

  return (
    <DispatchScanner
      routeId={route.id}
      routeName={route.name}
      deliveries={route.deliveries.map((d) => ({
        id: d.id,
        customerName: d.customerName,
        suburb: d.suburb,
        scanned: scannedIds.has(d.id),
      }))}
    />
  );
}
