import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageDrivers } from "@/lib/permissions";
import { WAREHOUSE_AUDIT_CATEGORY_LABEL, type WarehouseAuditCategory } from "@/lib/warehouseAudit";
import { WarehouseAuditForm } from "@/components/WarehouseAuditForm";
import { ResolveAuditItemButton } from "@/components/ResolveAuditItemButton";

export default async function WarehouseAuditsPage() {
  const session = await auth();
  if (!session || !canManageDrivers(session.user.role)) redirect("/login");

  const [drivers, vehicles, organisations, audits] = await Promise.all([
    prisma.user.findMany({ where: { role: "DRIVER", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.vehicle.findMany({ where: { active: true }, orderBy: { registration: "asc" }, select: { id: true, registration: true } }),
    prisma.organisation.findMany({ where: { active: true }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    prisma.warehouseAudit.findMany({
      include: {
        driver: { select: { name: true } },
        auditor: { select: { name: true } },
        vehicle: { select: { registration: true } },
        organisation: { select: { companyName: true } },
        items: true,
      },
      orderBy: { auditedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Weekly warehouse audits</h1>
        <p className="text-sm text-dim">Uniform/PPE, standard equipment, and vehicle condition compliance checks.</p>
      </div>

      <WarehouseAuditForm drivers={drivers} vehicles={vehicles} organisations={organisations} />

      <div className="space-y-3">
        {audits.map((a) => {
          const fails = a.items.filter((i) => i.result === "FAIL");
          return (
            <div key={a.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {a.driver.name} {a.vehicle && `· ${a.vehicle.registration}`}
                  </p>
                  <p className="text-xs text-dim">
                    Audited by {a.auditor.name} on {new Date(a.auditedAt).toLocaleString("en-AU")}
                    {a.organisation && ` · ${a.organisation.companyName}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    fails.length === 0 ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"
                  }`}
                >
                  {fails.length === 0 ? "All items passed" : `${fails.length} item${fails.length === 1 ? "" : "s"} failed`}
                </span>
              </div>
              {a.notes && <p className="text-sm text-dim">{a.notes}</p>}
              {fails.length > 0 && (
                <div className="space-y-2 border-t border-line pt-2">
                  {fails.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <p className="font-medium">
                          {WAREHOUSE_AUDIT_CATEGORY_LABEL[item.category as WarehouseAuditCategory]}
                          {item.critical && <span className="ml-2 text-xs font-semibold text-[#DC2626]">CRITICAL</span>}
                        </p>
                        {item.correctiveAction && <p className="text-xs text-dim">{item.correctiveAction}</p>}
                        {item.dueDate && (
                          <p className="text-xs text-muted">Due {new Date(item.dueDate).toLocaleDateString("en-AU")}</p>
                        )}
                        {item.photoUrl && (
                          <a href={`/api/files/warehouse-audit-photo/${item.id}`} target="_blank" rel="noreferrer" className="text-xs text-brand-400 hover:underline">
                            View photo →
                          </a>
                        )}
                      </div>
                      <ResolveAuditItemButton itemId={item.id} resolved={item.resolved} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {audits.length === 0 && <p className="text-center text-sm text-muted">No audits recorded yet.</p>}
      </div>
    </div>
  );
}
