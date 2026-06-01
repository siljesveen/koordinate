"use client";

import TopNav from "@/app/TopNav";
import DevDataStatus from "@/components/DevDataStatus";
import SkySaveBanner from "@/components/SkySaveBanner";
import SkySyncBanner from "@/components/SkySyncBanner";
import { usePathname } from "next/navigation";

const HIDE_NAV_PREFIXES = ["/login", "/auth"];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return (
    <>
      <DevDataStatus />
      <SkySaveBanner />
      <SkySyncBanner />
      {!hideNav ? <TopNav /> : null}
      {children}
    </>
  );
}
