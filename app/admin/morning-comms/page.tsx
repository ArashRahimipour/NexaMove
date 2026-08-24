import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageMorningComms } from "@/lib/permissions";
import { MORNING_COMM_ISSUE_LABEL, type MorningCommIssueType } from "@/lib/morningComm";
import { MorningCommForm } from "@/components/MorningCommForm";
import { MorningCommStatusButtons } from "@/components/MorningCommStatusButtons";

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-[#FEF2F2] text-[#DC2626]",
  IN_PROGRESS: "bg-[#FFF7ED] text-[#C2410C]",
  RESOLVED: "bg-[#DCFCE7] text-[#16A34A]",
};

export default async function MorningCommsPage() {
  const session = await auth();
  if (!session || !canManageMorningComms(session.user.role)) redirect("/login");

  const [drivers, vehicles, organisations, logs] = await Promise.all([
    prisma.user.findMany({ where: { role: "DRIVER", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.vehicle.findMany({ where: { active: true }, orderBy: { registration: "asc" }, select: { id: true, registration: true } }),
    prisma.organisation.findMany({ where: { active: true }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    prisma.morningCommunicationLog.findMany({
      include: {
        delivery: { select: { id: true, customerName: true, trackingCode: true } },
        driver: { select: { name: true } },
        vehicle: { select: { registration: true } },
        organisation: { select: { companyName: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Morning communication</h1>
        <p className="text-sm text-dim">
          Warehouse issues, overnight exceptions, damaged/missing stock, and driver or customer issues raised before
          the day&apos;s runs start.
        </p>
      </div>

      <MorningCommForm drivers={drivers} vehicles={vehicles} organisations={organisations} />

      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="card space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{MORNING_COMM_ISSUE_LABEL[log.issueType as MorningCommIssueType]}</p>
                <p className="text-xs text-dim">
                  {new Date(log.date).toLocaleDateString("en-AU")}
                  {log.organisation && ` · ${log.organisation.companyName}`}
                  {log.driver && ` · Driver: ${log.driver.name}`}
                  {log.vehicle && ` · ${log.vehicle.registration}`}
                </p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLE[log.status]}`}>
                {log.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="text-sm">{log.description}</p>
            {log.actionRequired && (
              <p className="text-sm text-dim">
                <span className="font-medium">Action required:</span> {log.actionRequired}
              </p>
            )}
            {log.responsiblePerson && (
              <p className="text-xs text-muted">Responsible: {log.responsiblePerson}</p>
            )}
            {log.attachmentUrl && (
              <a href={`/api/files/morning-comm-attachment/${log.id}`} target="_blank" rel="noreferrer" className="text-xs text-brand-400 hover:underline">
                View attachment →
              </a>
            )}
            <MorningCommStatusButtons id={log.id} status={log.status} />
          </div>
        ))}
        {logs.length === 0 && <p className="text-center text-sm text-muted">No issues logged yet.</p>}
      </div>
    </div>
  );
}
