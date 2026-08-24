import Link from "next/link";
import { Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visibleNavSections } from "@/lib/permissions";
import { computeOpsSummary } from "@/lib/ai/opsSummary";

const FINISHED_STATUSES = ["DELIVERED", "PARTIALLY_DELIVERED", "FAILED", "CANCELLED", "RETURNED"] as const;

export default async function AdminDashboardPage() {
  const session = await auth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [routesToday, activeDrivers, deliveriesToday, openAlerts] = await Promise.all([
    prisma.route.count({ where: { date: { gte: today, lt: tomorrow } } }),
    prisma.user.count({ where: { role: "DRIVER", active: true } }),
    prisma.delivery.findMany({
      where: { route: { date: { gte: today, lt: tomorrow } } },
      select: { status: true },
    }),
    prisma.alert.count({ where: { status: "OPEN" } }),
  ]);

  const delivered = deliveriesToday.filter((d) => d.status === "DELIVERED" || d.status === "PARTIALLY_DELIVERED").length;
  const failed = deliveriesToday.filter((d) => d.status === "FAILED").length;
  const finished = deliveriesToday.filter((d) => FINISHED_STATUSES.includes(d.status as (typeof FINISHED_STATUSES)[number])).length;

  const visible = new Set(session ? visibleNavSections(session.user.role) : []);
  const aiSummary = visible.has("ai") ? await computeOpsSummary() : null;
  const aiAttentionCount = aiSummary ? aiSummary.critical.length + aiSummary.attention.length : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Operations overview</h1>

      {aiSummary && (
        <div className="card flex items-center justify-between gap-4 border-brand-500/20 shadow-glow">
          <div className="flex items-start gap-3">
            <div className="inline-flex shrink-0 rounded-[10px] bg-brand-500/10 p-2 text-brand-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-ink">NexaMove AI</p>
              <p className="text-sm text-dim">
                {aiAttentionCount === 0
                  ? "Nothing needs urgent attention right now."
                  : `There ${aiAttentionCount === 1 ? "is" : "are"} ${aiAttentionCount} item${aiAttentionCount === 1 ? "" : "s"} that may need attention.`}
              </p>
              {aiSummary.critical.length > 0 && (
                <p className="mt-1 text-xs text-danger">{aiSummary.critical.length} critical</p>
              )}
              {aiSummary.attention.length > 0 && (
                <p className="text-xs text-warn">{aiSummary.attention.length} need attention</p>
              )}
            </div>
          </div>
          <Link href="/admin/ai" className="btn-secondary shrink-0">
            Review with AI
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-sm text-dim">Routes today</p>
          <p className="text-3xl font-bold">{routesToday}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dim">Active drivers</p>
          <p className="text-3xl font-bold">{activeDrivers}</p>
        </div>
        <div className="card">
          <p className="text-sm text-dim">Delivered today</p>
          <p className="text-3xl font-bold">
            {delivered}/{deliveriesToday.length}
          </p>
          <p className="text-xs text-muted">{finished} finished · {failed} failed</p>
        </div>
        <div className="card">
          <p className="text-sm text-dim">Open alerts</p>
          <p className="text-3xl font-bold">{openAlerts}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/routes" className="btn-primary">
          Manage routes
        </Link>
        {visible.has("drivers") && (
          <Link href="/admin/drivers" className="btn-secondary">
            Manage drivers
          </Link>
        )}
        {visible.has("dispatch") && (
          <Link href="/admin/dispatch" className="btn-secondary">
            Dispatch
          </Link>
        )}
        {visible.has("kpi") && (
          <Link href="/admin/kpi" className="btn-secondary">
            KPI dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
