import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManagePricingData } from "@/lib/permissions";
import { PricingSubNav } from "@/components/PricingSubNav";
import { ZoneEditor } from "@/components/ZoneEditor";

export default async function ZonesPage() {
  const session = await auth();
  if (!session || !canManagePricingData(session.user.role)) redirect("/login");

  const zones = await prisma.deliveryZone.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Delivery Zones</h1>
      <PricingSubNav active="/admin/pricing/zones" />

      <div className="card border-warn/40 bg-elevated text-sm text-dim">
        Zone codes were imported from historical invoices, but the actual adjustment model and dollar amounts for
        each zone are not yet confirmed. Set the model and numbers per zone below once you&apos;ve reviewed the
        historical invoices, or use the Rate Intelligence tool to help identify them.
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-elevated text-dim">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Postcodes</th>
              <th className="px-4 py-3">Adjustment model</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Minimum charge</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <ZoneEditor key={z.id} zone={z} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
