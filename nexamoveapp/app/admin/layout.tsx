import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DISPATCHER")) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-bold text-brand-700">
              NexaMove
            </Link>
            <nav className="flex gap-4 text-sm font-medium text-slate-600">
              <Link href="/admin/routes" className="hover:text-brand-700">
                Routes
              </Link>
              {session.user.role === "ADMIN" && (
                <Link href="/admin/drivers" className="hover:text-brand-700">
                  Drivers
                </Link>
              )}
            </nav>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
