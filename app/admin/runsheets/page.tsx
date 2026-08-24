import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { canManageRunsheetImports } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RunsheetUploadForm } from "@/components/RunsheetUploadForm";

export default async function RunsheetsPage() {
  const session = await auth();
  if (!session || !canManageRunsheetImports(session.user.role)) redirect("/login");

  const [imports, organisations] = await Promise.all([
    prisma.runsheetImport.findMany({
      include: { organisation: { select: { companyName: true } }, importedBy: { select: { name: true } } },
      orderBy: { importedAt: "desc" },
      take: 50,
    }),
    prisma.organisation.findMany({ select: { id: true, companyName: true }, orderBy: { companyName: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Third-party runsheet imports</h1>
      <RunsheetUploadForm organisations={organisations} />
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-dim">
            <tr>
              <th className="px-4 py-3">Imported</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Rows</th>
              <th className="px-4 py-3">Matched</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {imports.map((imp) => (
              <tr key={imp.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-dim">
                  {new Date(imp.importedAt).toLocaleString("en-AU")}
                  <div className="text-xs text-muted">by {imp.importedBy.name}</div>
                </td>
                <td className="px-4 py-3">{imp.source}</td>
                <td className="px-4 py-3 text-dim">{imp.organisation?.companyName ?? "—"}</td>
                <td className="px-4 py-3 text-dim">{imp.fileName}</td>
                <td className="px-4 py-3">{imp.totalRows}</td>
                <td className="px-4 py-3">
                  {imp.matchedRows}/{imp.totalRows}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/runsheets/${imp.id}`} className="text-brand-400 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {imports.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  No runsheets imported yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
