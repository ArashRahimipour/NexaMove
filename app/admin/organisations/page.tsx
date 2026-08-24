import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageOrganisations } from "@/lib/permissions";
import { CreateOrganisationForm } from "@/components/CreateOrganisationForm";
import { DeleteButton } from "@/components/DeleteButton";

export default async function OrganisationsPage() {
  const session = await auth();
  const canDelete = session ? canManageOrganisations(session.user.role) : false;
  const organisations = await prisma.organisation.findMany({
    include: { _count: { select: { deliveries: true, users: true } } },
    orderBy: { companyName: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Retail clients</h1>
        <CreateOrganisationForm />
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Deliveries</th>
              <th className="px-4 py-3">Portal users</th>
              <th className="px-4 py-3">Status</th>
              {canDelete && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {organisations.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{o.companyName}</td>
                <td className="px-4 py-3 text-dim">
                  {o.contactName ?? "—"} {o.phone ? `· ${o.phone}` : ""}
                </td>
                <td className="px-4 py-3 text-dim">{o._count.deliveries}</td>
                <td className="px-4 py-3 text-dim">{o._count.users}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${o.active ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-elevated text-dim"}`}>
                    {o.active ? "Active" : "Inactive"}
                  </span>
                </td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <DeleteButton endpoint={`/api/organisations/${o.id}`} itemLabel="retail client" />
                  </td>
                )}
              </tr>
            ))}
            {organisations.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 6 : 5} className="px-4 py-6 text-center text-muted">
                  No retail clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
