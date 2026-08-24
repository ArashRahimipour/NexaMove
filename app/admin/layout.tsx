import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Route,
  Truck,
  Users,
  BarChart3,
  Bell,
  Headphones,
  Wallet,
  Building2,
  ClipboardList,
  Settings,
  Sparkles,
  Calculator,
  PackageSearch,
  CalendarDays,
  ClipboardCheck,
  Sunrise,
  ShieldCheck,
  UserCheck,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { AdminNavLink } from "@/components/AdminNavLink";
import { canViewAdminDashboard, visibleNavSections } from "@/lib/permissions";

// Every page under here is per-session, back-office-specific data — never
// safe to prerender. See app/driver/layout.tsx for why this matters at
// build time (next-auth throws "Invalid URL" instead of Next gracefully
// falling back to dynamic rendering when NEXTAUTH_URL isn't set yet).
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { key: "ai", href: "/admin/ai", label: "NexaMove AI", icon: Sparkles },
  { key: "routes", href: "/admin/routes", label: "Routes", icon: Route },
  { key: "dispatch", href: "/admin/dispatch", label: "Dispatch", icon: Truck },
  { key: "drivers", href: "/admin/drivers", label: "Drivers", icon: Users },
  { key: "vehicles", href: "/admin/vehicles", label: "Vehicles", icon: Truck },
  { key: "warehouse-audits", href: "/admin/warehouse-audits", label: "Warehouse Audits", icon: ClipboardCheck },
  { key: "morning-comms", href: "/admin/morning-comms", label: "Morning Communication", icon: Sunrise },
  { key: "fleet", href: "/admin/fleet", label: "Dedicated Fleet", icon: ShieldCheck },
  { key: "warehouse-reps", href: "/admin/warehouse-reps", label: "Warehouse Reps", icon: UserCheck },
  { key: "pricing", href: "/admin/pricing", label: "Pricing", icon: Calculator },
  { key: "kpi", href: "/admin/kpi", label: "KPI", icon: BarChart3 },
  { key: "reports-eod", href: "/admin/reports/eod", label: "EOD Report", icon: FileText },
  { key: "alerts", href: "/admin/alerts", label: "Alerts", icon: Bell },
  { key: "returns", href: "/admin/returns", label: "Returns", icon: PackageSearch },
  { key: "customer-service", href: "/admin/customer-service", label: "Customer Service", icon: Headphones },
  { key: "settlements", href: "/admin/settlements", label: "Settlements", icon: Wallet },
  { key: "runsheets", href: "/admin/runsheets", label: "Runsheet Imports", icon: FileSpreadsheet },
  { key: "organisations", href: "/admin/organisations", label: "Retail Clients", icon: Building2 },
  { key: "servicing", href: "/admin/servicing", label: "Servicing Days", icon: CalendarDays },
  { key: "audit", href: "/admin/audit", label: "Audit Log", icon: ClipboardList },
  { key: "settings", href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || !canViewAdminDashboard(session.user.role)) {
    redirect("/login");
  }

  const visible = new Set(visibleNavSections(session.user.role));
  const roleLabel = session.user.role.replaceAll("_", " ");

  return (
    <div className="flex h-screen overflow-hidden bg-elevated">
      <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto bg-navy">
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-[18px] py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-brand-500 text-lg">🚚</div>
          <div>
            <p className="text-[15px] font-extrabold text-white">NexaMove</p>
            <p className="-mt-0.5 text-[10px] text-white/45">Logistics Platform</p>
          </div>
        </div>
        <div className="mx-3.5 mt-3 rounded-lg border border-brand-500/30 bg-brand-500/15 px-3 py-2 text-xs font-semibold text-brand-500">
          {roleLabel}
        </div>
        <nav className="flex-1 py-3.5">
          {NAV_ITEMS.filter((item) => visible.has(item.key)).map((item) => (
            <AdminNavLink
              key={item.key}
              href={item.href}
              label={item.label}
              icon={<item.icon className="h-[17px] w-[17px]" strokeWidth={2} />}
            />
          ))}
        </nav>
        <div className="border-t border-white/[0.07] px-[18px] py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
              {session.user.name?.charAt(0) ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white">{session.user.name}</p>
              <p className="truncate text-[11px] text-white/45">{session.user.email}</p>
            </div>
            <div className="ml-auto shrink-0">
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-line bg-card px-6 shadow-card">
          <Link href="/admin" className="text-sm font-semibold text-ink">
            NexaMove
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
