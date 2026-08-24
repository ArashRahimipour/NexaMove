import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManagePricingData } from "@/lib/permissions";
import { PricingSubNav } from "@/components/PricingSubNav";
import { ExtraAmountEditor } from "@/components/ExtraAmountEditor";
import { CarrierMappingEditor } from "@/components/CarrierMappingEditor";

export default async function PricingSettingsPage() {
  const session = await auth();
  if (!session || !canManagePricingData(session.user.role)) redirect("/login");

  const [extras, fuelLevies, mappings, serviceTypes] = await Promise.all([
    prisma.pricingExtra.findMany({ orderBy: { label: "asc" } }),
    prisma.fuelLevyRule.findMany({ where: { active: true }, orderBy: { effectiveFrom: "desc" } }),
    prisma.carrierServiceCodeMapping.findMany({ include: { serviceType: true }, orderBy: { sourceCode: "asc" } }),
    prisma.serviceType.findMany({ orderBy: { label: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Extras &amp; Fuel Levy</h1>
      <PricingSubNav active="/admin/pricing/settings" />

      <div className="card space-y-3">
        <h2 className="font-semibold">Pricing extras</h2>
        <p className="text-sm text-dim">Assembly, stairs, and additional labour charges. No dollar amounts are assumed — enter your confirmed commercial rates.</p>
        <div className="space-y-2">
          {extras.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
              <span className="text-sm font-medium">{e.label}</span>
              <ExtraAmountEditor id={e.id} initialAmount={e.amount} needsConfirmation={e.needsConfirmation} unit={e.amountType === "PER_HOUR" ? "/ hour" : "flat"} />
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Fuel levy</h2>
        <p className="text-sm text-dim">Current QLD default is 10.65% of the nett delivery charge. Configurable by client, state, or rate card, with effective dates.</p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-elevated text-dim">
              <tr>
                <th className="px-4 py-2 text-xs font-bold uppercase tracking-wide">Scope</th>
                <th className="px-4 py-2 text-xs font-bold uppercase tracking-wide">Percentage</th>
                <th className="px-4 py-2 text-xs font-bold uppercase tracking-wide">Effective from</th>
              </tr>
            </thead>
            <tbody>
              {fuelLevies.map((f) => (
                <tr key={f.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">{f.organisationId ? "Client-specific" : f.rateCardId ? "Rate card" : f.state ? `State: ${f.state}` : "Company default"}</td>
                  <td className="px-4 py-2 font-medium">{f.percentage}%</td>
                  <td className="px-4 py-2 text-dim">{new Date(f.effectiveFrom).toLocaleDateString("en-AU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Carrier service code mappings</h2>
        <p className="text-sm text-dim">
          Imported carrier codes are never auto-interpreted — confirm what each one actually means before the Rate Intelligence tool uses it with full confidence.
        </p>
        <div className="space-y-2">
          {mappings.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
              <div>
                <p className="text-sm font-medium">&quot;{m.sourceCode}&quot;</p>
                {m.suggestedLabel && <p className="text-xs text-muted">{m.suggestedLabel}</p>}
              </div>
              <CarrierMappingEditor id={m.id} serviceTypes={serviceTypes} currentServiceTypeId={m.serviceTypeId} confirmed={m.confirmed} />
            </div>
          ))}
          {mappings.length === 0 && <p className="text-sm text-muted">No carrier codes imported yet.</p>}
        </div>
      </div>
    </div>
  );
}
