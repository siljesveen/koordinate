"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TopNav.module.css";

const NAV_ITEMS: { href: string; label: string; group: "plan" | "ressurs" | "admin" }[] = [
  { href: "/plan", label: "Plan", group: "plan" },
  { href: "/masterplan", label: "Masterplan", group: "plan" },
  { href: "/ansatte", label: "Ansatte", group: "ressurs" },
  { href: "/biler", label: "Biler", group: "ressurs" },
  { href: "/henger", label: "Hengere", group: "ressurs" },
  { href: "/kjoretoy-utilgjengelig", label: "Utilgjengelighet", group: "ressurs" },
  { href: "/fravaer", label: "Fravær", group: "admin" },
  { href: "/innstillinger", label: "Innstillinger", group: "admin" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <div className={styles.navWrap}>
      <nav className={styles.nav} aria-label="Hovedmeny">
        <Link href="/" className={styles.brand}>
          <span className={styles.brandIcon}>KO</span>
          <span className={styles.brandText}>KOordinate</span>
        </Link>

        <div className={styles.divider} />

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.linkBtn} ${isActive ? styles.linkBtnActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}

        <div className={styles.spacer} />
      </nav>
    </div>
  );
}
