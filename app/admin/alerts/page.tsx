import Link from "next/link";
import { BellOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AlertActions } from "@/components/AlertActions";
import { EmptyState } from "@/components/EmptyState";

const TYPE_LABEL: Record<string, string> = {
  DELIVERY_DELAYED: "Delivery delayed",
  FAILED_DELIVERY: "Failed delivery",
  DAMAGE_REPORT: "Damage report",
  LOW_RATING: "Low customer rating",
  LICENCE_EXPIRY: "Licence expiry",
  VEHICLE_COMPLIANCE_EXPIRY: "Vehicle compliance expiry",
  DRIVER_OFFLINE: "Driver offline",
  GEOFENCE_WARNING: "Geofence warning",
  MISSING_POD: "Missing POD",
  ROUTE_LATE: "Route running late",
  CAPACITY_EXCEEDED: "Capacity exceeded",
  RETAIL_CLIENT_ISSUE: "Retail client issue",
};

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`card flex items-center justify-between gap-3 border-l-4 ${
              a.status === "OPEN"
                ? "border-l-danger"
                : a.status === "ACKNOWLEDGED"
                  ? "border-l-warn"
                  : "border-l-ok"
            }`}
          >
            <div>
              <p className="font-semibold">{TYPE_LABEL[a.type] ?? a.type}</p>
              <p className="text-sm text-dim">{a.message}</p>
              <p className="text-xs text-muted">{new Date(a.createdAt).toLocaleString("en-AU")}</p>
              {a.deliveryId && (
                <Link href={`/admin/deliveries/${a.deliveryId}`} className="text-xs text-brand-400 hover:underline">
                  View delivery →
                </Link>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  a.status === "OPEN" ? "bg-[#FEF2F2] text-[#DC2626]" : a.status === "ACKNOWLEDGED" ? "bg-[#FFF7ED] text-[#C2410C]" : "bg-[#DCFCE7] text-[#16A34A]"
                }`}
              >
                {a.status}
              </span>
              <AlertActions alertId={a.id} status={a.status} />
            </div>
          </div>
        ))}
        {alerts.length === 0 && (
          <EmptyState icon={BellOff} title="No alerts" description="Damage reports and failed deliveries will raise alerts here automatically." />
        )}
      </div>
    </div>
  );
}
