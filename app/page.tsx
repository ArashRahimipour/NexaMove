import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/permissions";

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (canViewAdminDashboard(session.user.role)) {
    redirect("/admin");
  }

  if (session.user.role === "RETAIL_CLIENT") {
    redirect("/client");
  }

  redirect("/driver");
}
