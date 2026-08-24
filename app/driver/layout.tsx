import { DriverLocationTracker } from "@/components/DriverLocationTracker";

// middleware.ts already gates every /driver/* route to the DRIVER role —
// this layout only adds the background location tracker, mounted once for
// the whole driver app rather than duplicated per page.
//
// force-dynamic: every page under here reads the driver's own session and
// today's route — there's nothing safe to prerender. Without this, a build
// environment missing NEXTAUTH_URL (e.g. before it's configured on a fresh
// host) makes next-auth's getServerSession throw "Invalid URL" while Next
// tries to statically generate these pages, failing the whole build.
export const dynamic = "force-dynamic";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DriverLocationTracker />
      {children}
    </>
  );
}
