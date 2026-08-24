import Link from "next/link";

const TABS = [
  { href: "/admin/pricing", label: "Calculator" },
  { href: "/admin/pricing/rate-cards", label: "Rate Cards" },
  { href: "/admin/pricing/zones", label: "Zones" },
  { href: "/admin/pricing/settings", label: "Extras & Fuel Levy" },
  { href: "/admin/pricing/analyser", label: "Rate Intelligence" },
];

export function PricingSubNav({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-line pb-3">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            t.href === active ? "bg-brand-500 text-white" : "bg-elevated text-dim hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
