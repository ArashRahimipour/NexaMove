import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DELIVERY_STATUS_LABEL } from "@/lib/status-workflow";
import { CustomerAiWidget } from "@/components/CustomerAiWidget";
import { LiveTrackingMap } from "@/components/LiveTrackingMap";

const EVENT_LABEL: Record<string, string> = {
  JOB_CREATED: "Booking confirmed",
  DRIVER_ASSIGNED: "Driver assigned",
  LOADED: "Loaded onto vehicle",
  ROUTE_STARTED: "Driver on the way",
  EN_ROUTE: "Driver on the way",
  CUSTOMER_NOTIFIED: "Customer notified",
  DRIVER_NEARBY: "Driver nearby",
  ARRIVED: "Driver arrived at address",
  UNLOADING: "Unloading",
  ASSEMBLY_STARTED: "Assembly in progress",
  PHOTO_CAPTURED: "Delivery photo captured",
  SIGNATURE_CAPTURED: "Signature captured",
  DAMAGE_NOTED: "Damage noted",
  DELIVERED: "Delivery completed",
  FAILED: "Delivery attempt failed",
  DAMAGED: "Damage recorded",
  PARTIALLY_DELIVERED: "Delivery partially completed",
  RETURNED: "Item returned",
  RESCHEDULED: "Delivery rescheduled",
  CANCELLED: "Delivery cancelled",
  STATUS_OVERRIDE: "Status updated",
};

export default async function TrackingPage({ params }: { params: { code: string } }) {
  // Only the fields this public, unauthenticated page actually renders —
  // never the full Delivery row (which includes customer contact details,
  // every charge/payment field, internal notes, etc.) or the full
  // ProofOfDelivery/DamageReport rows (which include GPS coordinates,
  // internal staff IDs, and — for damage — responsibility findings not
  // meant for the customer).
  const delivery = await prisma.delivery.findUnique({
    where: { trackingCode: params.code },
    select: {
      trackingCode: true,
      status: true,
      suburb: true,
      postcode: true,
      windowStart: true,
      windowEnd: true,
      trackingEvents: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, createdAt: true },
      },
      proofOfDelivery: {
        select: { receiverName: true, contactless: true, capturedAt: true },
      },
      damageReports: { select: { id: true } },
    },
  });

  if (!delivery) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <h1 className="text-xl font-bold text-brand-400">NexaMove tracking</h1>
      <p className="mt-1 text-sm text-dim">
        Delivery to {delivery.suburb} QLD {delivery.postcode}
      </p>

      <div className="card mt-4">
        <p className="text-sm text-dim">Status</p>
        <p className="text-2xl font-bold">{DELIVERY_STATUS_LABEL[delivery.status]}</p>
        {delivery.windowStart && delivery.windowEnd && (
          <p className="mt-1 text-sm text-dim">
            Window: {new Date(delivery.windowStart).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })} –{" "}
            {new Date(delivery.windowEnd).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </div>

      <LiveTrackingMap trackingCode={delivery.trackingCode} />

      <ol className="mt-6 space-y-4 border-l-2 border-line pl-4">
        {delivery.trackingEvents.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-brand-600" />
            <p className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</p>
            <p className="text-xs text-dim">
              {new Date(e.createdAt).toLocaleString("en-AU")}
            </p>
          </li>
        ))}
        {delivery.trackingEvents.length === 0 && (
          <li className="text-sm text-muted">No tracking events yet.</li>
        )}
      </ol>

      {delivery.proofOfDelivery && (
        <div className="card mt-6 space-y-2">
          <h2 className="font-semibold">Proof of delivery</h2>
          {delivery.proofOfDelivery.receiverName && (
            <p className="text-sm text-dim">
              Received by <strong>{delivery.proofOfDelivery.receiverName}</strong> on{" "}
              {new Date(delivery.proofOfDelivery.capturedAt).toLocaleString("en-AU")}
            </p>
          )}
          {delivery.proofOfDelivery.contactless && (
            <p className="text-sm text-dim">Delivered contactless.</p>
          )}
          {delivery.damageReports.length > 0 && (
            <p className="text-sm font-medium text-[#C2410C]">Damage was noted on this delivery — under review.</p>
          )}
        </div>
      )}

      <CustomerAiWidget trackingCode={delivery.trackingCode} />
    </div>
  );
}
