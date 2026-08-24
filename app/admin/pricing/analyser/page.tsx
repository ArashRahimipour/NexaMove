import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canManagePricingData } from "@/lib/permissions";
import { PricingSubNav } from "@/components/PricingSubNav";
import { InvoiceAnalyser } from "@/components/InvoiceAnalyser";

export default async function AnalyserPage() {
  const session = await auth();
  if (!session || !canManagePricingData(session.user.role)) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Rate Intelligence / Invoice Analyser</h1>
      <PricingSubNav active="/admin/pricing/analyser" />
      <InvoiceAnalyser />
    </div>
  );
}
