import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "NexaMove — Queensland Delivery Operations",
  description: "Real-time logistics platform for live delivery operations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// force-dynamic here, not just on the admin/client/driver layouts: this
// error also hit "/", "/login", and "/_not-found" — every route in this
// app transitively imports next-auth (via lib/auth.ts or the Providers'
// SessionProvider), and next-auth resolves its base URL at module
// evaluation time, before Next's own per-route dynamic-API detection gets
// a chance to run. So without NEXTAUTH_URL set in the build environment,
// it throws "Invalid URL" while Next tries to prerender ANY page, not just
// the session-gated ones. Setting this on the root layout cascades to
// every route and stops Next from attempting to prerender anything at all.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
