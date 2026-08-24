import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewReturns } from "@/lib/permissions";
import { computeReturnSlaBand, hoursRemaining, nextReturnTaskStatus, RETURN_TASK_STATUS_LABEL } from "@/lib/returns";
import { ReturnTaskActions, RefreshSlaAlertsButton } from "@/components/ReturnTaskActions";
import { EmptyState } from "@/components/EmptyState";

const BAND_STYLE: Record<string, string> = {
  ON_TRACK: "bg-[#DCFCE7] text-[#16A34A]",
  WARNING: "bg-[#FFF7ED] text-[#C2410C]",
  OVERDUE: "bg-[#FEF2F2] text-[#DC2626]",
  NOT_STARTED: "bg-elevated text-dim",
  CLOSED: "bg-elevated text-muted",
};

const BAND_LABEL: Record<string, string> = {
  ON_TRACK: "On track",
  WARNING: "SLA warning",
  OVERDUE: "SLA overdue",
  NOT_STARTED: "Not yet collected",
  CLOSED: "Closed",
};

function formatRemaining(band: string, slaDeadline: Date | null): string {
  if (band === "NOT_STARTED" || band === "CLOSED" || !slaDeadline) return "—";
  const hrs = hoursRemaining(slaDeadline);
  if (hrs < 0) return `${Math.abs(hrs).toFixed(1)}h overdue`;
  return `${hrs.toFixed(1)}h remaining`;
}

export default async function ReturnsPage() {
  const session = await auth();
  if (!session || !canViewReturns(session.user.role)) redirect("/login");

  const returnTasks = await prisma.returnTask.findMany({
    where: { status: { not: "CLOSED" } },
    include: {
      delivery: { select: { id: true, customerName: true, trackingCode: true, externalReference: true } },
      driver: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: [{ slaDeadline: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const rows = returnTasks.map((task) => ({
    task,
    band: computeReturnSlaBand({ status: task.status, slaDeadline: task.slaDeadline }),
  }));
  const overdueCount = rows.filter((r) => r.band === "OVERDUE").length;
  const warningCount = rows.filter((r) => r.band === "WARNING").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Outstanding Returns</h1>
          <p className="text-sm text-dim">
            Collections and exchanges awaiting warehouse scan-in, within the 48-hour SLA.
          </p>
        </div>
        <RefreshSlaAlertsButton />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-dim">Outstanding</p>
          <p className="text-3xl font-bold">{rows.length}</p>
        </div>
        <div className="card border-warn/40">
          <p className="text-sm text-dim">SLA warning (&lt;24h)</p>
          <p className="text-3xl font-bold text-[#C2410C]">{warningCount}</p>
        </div>
        <div className="card border-danger/40">
          <p className="text-sm text-dim">Overdue</p>
          <p className="text-3xl font-bold text-[#DC2626]">{overdueCount}</p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map(({ task, band }) => (
          <div key={task.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{task.delivery.customerName}</p>
              <p className="text-sm text-dim">
                {task.delivery.externalReference ?? task.delivery.trackingCode} · Driver: {task.driver?.name ?? "Unassigned"}
              </p>
              {task.items.length > 0 && (
                <p className="text-xs text-muted">
                  {task.items.map((i) => `${i.description} ×${i.quantity}`).join(", ")}
                </p>
              )}
              <Link href={`/admin/deliveries/${task.delivery.id}`} className="text-xs text-brand-400 hover:underline">
                View delivery →
              </Link>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BAND_STYLE[band]}`}>{BAND_LABEL[band]}</span>
                <span className="text-xs text-muted">{formatRemaining(band, task.slaDeadline)}</span>
              </div>
              <p className="text-xs text-dim">{RETURN_TASK_STATUS_LABEL[task.status]}</p>
              <ReturnTaskActions
                returnTaskId={task.id}
                nextStatus={nextReturnTaskStatus(task.status)}
                nextLabel={
                  nextReturnTaskStatus(task.status) ? RETURN_TASK_STATUS_LABEL[nextReturnTaskStatus(task.status)!] : null
                }
              />
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <EmptyState icon={PackageSearch} title="No outstanding returns" description="Collections and exchanges will appear here until scanned in at the warehouse." />
        )}
      </div>
    </div>
  );
}
