import { prisma } from "@/lib/prisma";

export interface PriorityItem {
  label: string;
  detail: string;
  href?: string;
}

export interface OpsSummary {
  scheduled: number;
  completed: number;
  inTransit: number;
  delayed: number;
  failed: number;
  damaged: number;
  openCases: number;
  critical: PriorityItem[];
  attention: PriorityItem[];
}

// Plain rule-based counts — no AI call. This is what powers the dashboard
// card and the top of the Operations AI page cheaply; the AI is only
// invoked when the user actually asks a question or hits "Review with AI".
export async function computeOpsSummary(): Promise<OpsSummary> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Sequential, not Promise.all: production connects through a pooler with
  // connection_limit=1, and firing ~10 queries at once against it triggers
  // "prepared statement already exists" — see docs/DEPLOYMENT.md.
  const todaysDeliveries = await prisma.delivery.findMany({ where: { deliveryDate: { gte: start, lt: end } }, select: { status: true } });
  const delayedDeliveries = await prisma.delivery.count({
    where: {
      windowEnd: { lt: now },
      status: { in: ["ASSIGNED", "IN_TRANSIT", "DRIVER_NEARBY", "ARRIVED", "UNLOADING", "ASSEMBLY_IN_PROGRESS"] },
    },
  });
  const failedToday = await prisma.failedDeliveryReport.count({ where: { createdAt: { gte: start, lt: end } } });
  const damagedToday = await prisma.damageReport.count({ where: { createdAt: { gte: start, lt: end } } });
  const openCases = await prisma.customerServiceCase.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } });
  const expiredDrivers = await prisma.driver.findMany({ where: { active: true, licenceExpiry: { lt: now } }, select: { user: { select: { name: true } } } });
  const expiringDrivers = await prisma.driver.findMany({
    where: { active: true, licenceExpiry: { gte: now, lte: in7Days } },
    select: { user: { select: { name: true } }, licenceExpiry: true },
  });
  const expiredVehicles = await prisma.vehicle.findMany({
    where: { active: true, OR: [{ insuranceExpiry: { lt: now } }, { registrationExpiry: { lt: now } }] },
    select: { registration: true },
  });
  const expiringVehicles = await prisma.vehicle.findMany({
    where: {
      active: true,
      OR: [
        { insuranceExpiry: { gte: now, lte: in7Days } },
        { registrationExpiry: { gte: now, lte: in7Days } },
      ],
    },
    select: { registration: true },
  });
  const missingPod = await prisma.delivery.count({ where: { status: "DELIVERED", proofOfDelivery: null } });

  const completed = todaysDeliveries.filter((d) => d.status === "DELIVERED" || d.status === "PARTIALLY_DELIVERED").length;
  const inTransit = todaysDeliveries.filter((d) =>
    ["ROUTE_STARTED", "IN_TRANSIT", "DRIVER_NEARBY", "ARRIVED", "UNLOADING", "ASSEMBLY_IN_PROGRESS"].includes(d.status)
  ).length;

  const critical: PriorityItem[] = [
    ...expiredDrivers.map((d) => ({ label: "Licence expired", detail: `${d.user.name}'s driving licence has expired.`, href: "/admin/drivers" })),
    ...expiredVehicles.map((v) => ({ label: "Vehicle compliance expired", detail: `${v.registration} has expired insurance or registration.`, href: "/admin/vehicles" })),
  ];
  if (failedToday > 0) {
    critical.push({ label: "Failed deliveries today", detail: `${failedToday} deliveries failed today and need follow-up.`, href: "/admin/alerts" });
  }
  if (damagedToday > 0) {
    critical.push({ label: "Damage reported today", detail: `${damagedToday} damage report(s) filed today.`, href: "/admin/alerts" });
  }

  const attention: PriorityItem[] = [
    ...expiringDrivers.map((d) => ({
      label: "Licence expiring soon",
      detail: `${d.user.name}'s licence expires ${d.licenceExpiry ? new Date(d.licenceExpiry).toLocaleDateString("en-AU") : "soon"}.`,
      href: "/admin/drivers",
    })),
    ...expiringVehicles.map((v) => ({ label: "Vehicle compliance expiring soon", detail: `${v.registration} compliance expires within 7 days.`, href: "/admin/vehicles" })),
  ];
  if (delayedDeliveries > 0) {
    attention.push({ label: "Delayed deliveries", detail: `${delayedDeliveries} deliveries are past their expected window.`, href: "/admin/dispatch" });
  }
  if (openCases > 0) {
    attention.push({ label: "Open customer service cases", detail: `${openCases} cases need attention.`, href: "/admin/customer-service" });
  }
  if (missingPod > 0) {
    attention.push({ label: "Missing proof of delivery", detail: `${missingPod} completed deliveries have no POD on file.`, href: "/admin/routes" });
  }

  return {
    scheduled: todaysDeliveries.length,
    completed,
    inTransit,
    delayed: delayedDeliveries,
    failed: failedToday,
    damaged: damagedToday,
    openCases,
    critical,
    attention,
  };
}
