"use client";

import TopNav from "@/app/TopNav";
import { usePathname } from "next/navigation";

const HIDE_NAV_PREFIXES = ["/login", "/auth", "/skjerm"];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return (
    <>
      {!hideNav ? <TopNav /> : null}
      {children}
    </>
  );
}
