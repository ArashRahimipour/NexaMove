import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DELIVERY_STATUS_COLOR, DELIVERY_STATUS_LABEL } from "@/lib/status-workflow";
import { ClientCreateDeliveryForm } from "@/components/ClientCreateDeliveryForm";

export default async function ClientPortalPage() {
  const session = await auth();
  const organisationId = session?.user.organisationId;

  const deliveries = organisationId
    ? await prisma.delivery.findMany({
        where: { organisationId },
        include: { damageReports: true, failedDeliveryReports: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your deliveries</h1>
        <ClientCreateDeliveryForm />
      </div>

      {!organisationId && (
        <div className="card text-center text-[#C2410C]">
          Your account isn&apos;t linked to a retail client organisation yet — contact NexaMove support.
        </div>
      )}

      <div className="space-y-2">
        {deliveries.map((d) => (
          <div key={d.id} className="card flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{d.customerName}</p>
              <p className="text-sm text-dim">
                {d.address}, {d.suburb} {d.state} {d.postcode}
              </p>
              {d.externalReference && <p className="text-xs text-muted">Ref: {d.externalReference}</p>}
              {(d.damageReports.length > 0 || d.failedDeliveryReports.length > 0) && (
                <p className="text-xs text-[#DC2626]">
                  {d.damageReports.length > 0 && "Damage reported "}
                  {d.failedDeliveryReports.length > 0 && "Delivery attempt failed"}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${DELIVERY_STATUS_COLOR[d.status]}`}>
                {DELIVERY_STATUS_LABEL[d.status]}
              </span>
              <Link href={`/track/${d.trackingCode}`} className="text-xs text-brand-400 hover:underline">
                Track →
              </Link>
            </div>
          </div>
        ))}
        {organisationId && deliveries.length === 0 && (
          <div className="card text-center text-muted">No deliveries yet — submit your first one above.</div>
        )}
      </div>
    </div>
  );
}
