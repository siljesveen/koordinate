"use client";

import TopNav from "@/app/TopNav";
import AppTransientBanner from "@/components/AppTransientBanner";
import DevDataStatus from "@/components/DevDataStatus";
import { usePathname } from "next/navigation";
import styles from "./AppChrome.module.css";

const HIDE_NAV_PREFIXES = ["/login", "/auth"];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return (
    <>
      <header className={styles.statusHeader}>
        <DevDataStatus />
        <AppTransientBanner />
      </header>
      {!hideNav ? <TopNav /> : null}
      {children}
    </>
  );
}
