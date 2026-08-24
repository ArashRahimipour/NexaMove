import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.role !== "RETAIL_CLIENT") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/client" className="font-bold text-brand-400">
            NexaMove — Client Portal
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
