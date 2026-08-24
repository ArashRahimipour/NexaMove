import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManagePricingData } from "@/lib/permissions";
import { PricingSubNav } from "@/components/PricingSubNav";
import { RateCardLineEditor } from "@/components/RateCardLineEditor";

export default async function RateCardsPage() {
  const session = await auth();
  if (!session || !canManagePricingData(session.user.role)) redirect("/login");

  const rateCards = await prisma.rateCard.findMany({
    include: {
      organisation: { select: { companyName: true } },
      lines: {
        include: { serviceType: true, cbmBand: true },
        orderBy: [{ serviceType: { label: "asc" } }, { cbmBand: { sortOrder: "asc" } }],
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Rate Cards</h1>
      <PricingSubNav active="/admin/pricing/rate-cards" />

      {rateCards.map((card) => (
        <div key={card.id} className="card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{card.name}</h2>
              <p className="text-xs text-muted">
                {card.state ?? "All states"} {card.organisation ? `· ${card.organisation.companyName} (client-specific)` : ""}
                {card.isDefault ? " · Default" : ""} · Effective from {new Date(card.effectiveFrom).toLocaleDateString("en-AU")}
              </p>
            </div>
          </div>

          {["Small Goods", "Standard Delivery"].map((label) => {
            const lines = card.lines.filter((l) => l.serviceType.label === label);
            if (lines.length === 0) return null;
            return (
              <div key={label} className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-elevated text-dim">
                    <tr>
                      <th className="px-4 py-2 text-xs font-bold uppercase tracking-wide">{label}</th>
                      <th className="px-4 py-2 text-xs font-bold uppercase tracking-wide">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2">{line.cbmBand.label}</td>
                        <td className="px-4 py-2">
                          <RateCardLineEditor lineId={line.id} initialPrice={line.price} needsConfirmation={line.needsConfirmation} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ))}

      {rateCards.length === 0 && <div className="card text-center text-muted">No rate cards yet.</div>}
    </div>
  );
}
