import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const BACK_OFFICE_ROLES = ["ADMIN", "OPERATIONS_MANAGER", "DISPATCHER", "CUSTOMER_SERVICE"];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (pathname.startsWith("/admin") && !BACK_OFFICE_ROLES.includes(role as string)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (pathname.startsWith("/driver") && role !== "DRIVER") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (pathname.startsWith("/client") && role !== "RETAIL_CLIENT") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/driver/:path*", "/client/:path*"],
};
