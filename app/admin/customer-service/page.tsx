import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageCustomerService } from "@/lib/permissions";
import { DELIVERY_STATUS_COLOR, DELIVERY_STATUS_LABEL } from "@/lib/status-workflow";
import { DeleteButton } from "@/components/DeleteButton";

export default async function CustomerServicePage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await auth();
  const canDelete = session ? canManageCustomerService(session.user.role) : false;
  const q = searchParams.q?.trim();

  const results = q
    ? await prisma.delivery.findMany({
        where: {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { customerPhone: { contains: q } },
            { address: { contains: q, mode: "insensitive" } },
            { externalReference: { contains: q, mode: "insensitive" } },
            { trackingCode: { contains: q } },
          ],
        },
        include: { proofOfDelivery: true, damageReports: true, failedDeliveryReports: true, customerServiceCases: true },
        take: 30,
        orderBy: { createdAt: "desc" },
      })
    : [];

  const openCases = await prisma.customerServiceCase.findMany({
    where: { status: { in: ["OPEN", "INVESTIGATING", "AWAITING_CUSTOMER", "AWAITING_OPERATIONS"] } },
    include: { delivery: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Customer service</h1>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by delivery ID, customer, phone, address, or reference…"
          className="field-input"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      {q && (
        <div className="space-y-2">
          {results.map((d) => (
            <Link key={d.id} href={`/admin/deliveries/${d.id}`} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold">{d.customerName}</p>
                <p className="text-sm text-dim">
                  {d.address}, {d.suburb} — {d.customerPhone ?? "no phone"}
                </p>
                {(d.damageReports.length > 0 || d.failedDeliveryReports.length > 0) && (
                  <p className="text-xs text-[#DC2626]">
                    {d.damageReports.length > 0 && `${d.damageReports.length} damage report(s) `}
                    {d.failedDeliveryReports.length > 0 && `${d.failedDeliveryReports.length} failed attempt(s)`}
                  </p>
                )}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${DELIVERY_STATUS_COLOR[d.status]}`}>
                {DELIVERY_STATUS_LABEL[d.status]}
              </span>
            </Link>
          ))}
          {results.length === 0 && <div className="card text-center text-muted">No matching deliveries.</div>}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Open cases</h2>
        <div className="space-y-2">
          {openCases.map((c) => (
            <div key={c.id} className="card flex items-center justify-between gap-3">
              <Link href={`/admin/deliveries/${c.deliveryId}`} className="min-w-0 flex-1">
                <p className="font-semibold">{c.delivery.customerName}</p>
                <p className="text-xs text-muted">Opened {new Date(c.createdAt).toLocaleString("en-AU")}</p>
              </Link>
              <span className="shrink-0 rounded-full bg-[#FFF7ED] px-2 py-1 text-xs font-medium text-[#C2410C]">
                {c.status.replaceAll("_", " ")}
              </span>
              {canDelete && <DeleteButton endpoint={`/api/cases/${c.id}`} itemLabel="case" />}
            </div>
          ))}
          {openCases.length === 0 && <div className="card text-center text-muted">No open cases.</div>}
        </div>
      </div>
    </div>
  );
}
