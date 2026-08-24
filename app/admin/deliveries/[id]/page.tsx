import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DELIVERY_STATUS_COLOR, DELIVERY_STATUS_LABEL } from "@/lib/status-workflow";
import { canSetDamageResponsibility } from "@/lib/permissions";
import { DamageResponsibilityForm } from "@/components/DamageResponsibilityForm";
import { OpenCaseButton } from "@/components/OpenCaseButton";
import { BackLink } from "@/components/BackLink";

const PHOTO_CATEGORY_LABEL: Record<string, string> = {
  PRODUCT_DELIVERED: "Product delivered",
  PRODUCT_IN_FINAL_LOCATION: "Product in final location",
  ASSEMBLY_COMPLETED: "Assembly completed",
  PACKAGING_REMOVED: "Packaging removed",
  CUSTOMER_PROPERTY_ACCESS: "Customer property / access",
  DAMAGE_CLOSEUP: "Damage",
  FAILED_DELIVERY_EVIDENCE: "Failed delivery evidence",
  OTHER: "Other",
};

export default async function DeliveryDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) notFound();

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: {
      route: { include: { driver: true } },
      items: true,
      photos: { orderBy: { uploadedAt: "desc" } },
      proofOfDelivery: true,
      damageReports: { orderBy: { createdAt: "desc" } },
      failedDeliveryReports: { orderBy: { createdAt: "desc" } },
      trackingEvents: { orderBy: { createdAt: "asc" } },
      customerServiceCases: { include: { notes: true }, orderBy: { createdAt: "desc" } },
      customerRating: true,
      organisation: true,
    },
  });

  if (!delivery) notFound();

  // Retail clients may only view their own organisation's deliveries.
  if (session.user.role === "RETAIL_CLIENT" && delivery.organisationId !== session.user.organisationId) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <BackLink />
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{delivery.customerName}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${DELIVERY_STATUS_COLOR[delivery.status]}`}>
            {DELIVERY_STATUS_LABEL[delivery.status]}
          </span>
        </div>
        <p className="text-sm text-dim">
          {delivery.address}, {delivery.suburb} {delivery.state} {delivery.postcode}
        </p>
        {delivery.organisation && <p className="text-xs text-muted">Client: {delivery.organisation.companyName}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card space-y-1 text-sm">
          <p className="font-semibold">Delivery details</p>
          <p>Driver: {delivery.route?.driver?.name ?? "Unassigned"}</p>
          <p>Reference: {delivery.externalReference ?? "—"}</p>
          <p>Phone: {delivery.customerPhone ?? "—"}</p>
          <p>Special instructions: {delivery.specialInstructions ?? "None"}</p>
          <p>Assembly required: {delivery.assemblyRequired ? "Yes" : "No"}</p>
          <p>Packaging removal required: {delivery.packagingRemovalRequired ? "Yes" : "No"}</p>
          <Link href={`/track/${delivery.trackingCode}`} className="inline-block pt-1 text-brand-400 hover:underline">
            Customer tracking link →
          </Link>
        </div>

        {delivery.items.length > 0 && (
          <div className="card space-y-1 text-sm">
            <p className="font-semibold">Items</p>
            {delivery.items.map((item) => (
              <p key={item.id}>
                {item.productDescription} × {item.quantity} — <span className="text-dim">{item.itemStatus}</span>
              </p>
            ))}
          </div>
        )}

        {delivery.proofOfDelivery && (
          <div className="card space-y-1 text-sm">
            <p className="font-semibold">Proof of delivery</p>
            <p>Receiver: {delivery.proofOfDelivery.receiverName ?? (delivery.proofOfDelivery.contactless ? "Contactless" : "—")}</p>
            {delivery.proofOfDelivery.receiverRelationship && <p>Relationship: {delivery.proofOfDelivery.receiverRelationship}</p>}
            <p>Captured: {new Date(delivery.proofOfDelivery.capturedAt).toLocaleString("en-AU")}</p>
            <p>GPS verified: {delivery.proofOfDelivery.geofenceVerified === false ? "⚠️ Overridden" : "✅ Yes"}</p>
            {delivery.proofOfDelivery.signatureUrl && (
              <a href={delivery.proofOfDelivery.signatureUrl} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
                View signature →
              </a>
            )}
          </div>
        )}

        {delivery.failedDeliveryReports.length > 0 && (
          <div className="card space-y-1 text-sm">
            <p className="font-semibold text-[#DC2626]">Failed delivery report(s)</p>
            {delivery.failedDeliveryReports.map((f) => (
              <div key={f.id} className="border-t border-line pt-1 first:border-0 first:pt-0">
                <p>{f.reason.replaceAll("_", " ")} — {new Date(f.createdAt).toLocaleString("en-AU")}</p>
                {f.notes && <p className="text-dim">{f.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {delivery.customerRating && (
          <div className="card space-y-1 text-sm">
            <p className="font-semibold">Customer rating</p>
            <p>{"⭐".repeat(delivery.customerRating.stars)}</p>
            {delivery.customerRating.comment && <p className="text-dim">&ldquo;{delivery.customerRating.comment}&rdquo;</p>}
          </div>
        )}
      </div>

      {delivery.damageReports.length > 0 && (
        <div className="card space-y-4">
          <p className="font-semibold">⚠️ Damage reports</p>
          {delivery.damageReports.map((d) => (
            <div key={d.id} className="space-y-2 border-b border-line pb-4 last:border-0">
              <p className="text-sm">
                <strong>{d.reason.replaceAll("_", " ")}</strong> — discovered {d.discoveredStage.replaceAll("_", " ").toLowerCase()}
              </p>
              <p className="text-sm text-dim">{d.description}</p>
              <p className="text-xs text-muted">Reported {new Date(d.createdAt).toLocaleString("en-AU")}</p>
              <p className="text-sm">
                Responsibility: <strong>{d.responsibility.replaceAll("_", " ")}</strong>
                {d.responsibilitySetAt && ` (set ${new Date(d.responsibilitySetAt).toLocaleDateString("en-AU")})`}
              </p>
              {canSetDamageResponsibility(session.user.role) && (
                <DamageResponsibilityForm deliveryId={delivery.id} damageReportId={d.id} current={d.responsibility} />
              )}
            </div>
          ))}
        </div>
      )}

      {delivery.photos.length > 0 && (
        <div className="card">
          <p className="mb-3 font-semibold">📷 Photos ({delivery.photos.length})</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {delivery.photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={PHOTO_CATEGORY_LABEL[p.category] ?? p.category} className="aspect-square w-full rounded-lg object-cover" />
                <p className="text-xs text-dim">{PHOTO_CATEGORY_LABEL[p.category] ?? p.category}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <p className="mb-3 font-semibold">Tracking timeline</p>
        <ol className="space-y-2 border-l-2 border-line pl-4">
          {delivery.trackingEvents.map((e) => (
            <li key={e.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-600" />
              {e.type.replaceAll("_", " ")} — <span className="text-muted">{new Date(e.createdAt).toLocaleString("en-AU")}</span>
              {e.note && <p className="text-dim">{e.note}</p>}
            </li>
          ))}
        </ol>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Customer service cases</p>
          <OpenCaseButton deliveryId={delivery.id} />
        </div>
        {delivery.customerServiceCases.length === 0 && <p className="text-sm text-muted">No cases opened.</p>}
        {delivery.customerServiceCases.map((c) => (
          <div key={c.id} className="border-t border-line pt-2 text-sm first:border-0 first:pt-0">
            <p className="font-medium">{c.status.replaceAll("_", " ")}</p>
            <p className="text-xs text-muted">Opened {new Date(c.createdAt).toLocaleString("en-AU")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
