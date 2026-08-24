"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// `icon` is a pre-rendered element (not a component reference) because
// component functions can't be passed as props across the server/client
// boundary — the icon's stroke uses currentColor, so the wrapping span's
// text colour drives it.
export function AdminNavLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 border-l-[3px] px-[18px] py-2.5 text-[13.5px] font-medium transition-colors duration-150 ease-out ${
        active
          ? "border-l-brand-500 bg-brand-500/10 text-brand-500"
          : "border-l-transparent text-white/55 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="w-[18px] shrink-0 text-center">{icon}</span>
      {label}
    </Link>
  );
}
