import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canUsePricingCalculator, canOverrideFuelLevy } from "@/lib/permissions";
import { PricingSubNav } from "@/components/PricingSubNav";
import { PricingCalculator } from "@/components/PricingCalculator";

export default async function PricingPage() {
  const session = await auth();
  if (!session || !canUsePricingCalculator(session.user.role)) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pricing Calculator</h1>
      <PricingSubNav active="/admin/pricing" />
      <PricingCalculator canOverrideFuelLevy={canOverrideFuelLevy(session.user.role)} />
    </div>
  );
}
