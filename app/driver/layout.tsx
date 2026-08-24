import { DriverLocationTracker } from "@/components/DriverLocationTracker";

// middleware.ts already gates every /driver/* route to the DRIVER role —
// this layout only adds the background location tracker, mounted once for
// the whole driver app rather than duplicated per page.
export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DriverLocationTracker />
      {children}
    </>
  );
}
