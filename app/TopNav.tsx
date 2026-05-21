"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { roleLabel } from "@/lib/auth/types";
import KoordinateLogo from "@/components/KoordinateLogo";
import GlobalSøk from "@/components/GlobalSøk";
import { useAuth } from "@/lib/state/authStore";
import styles from "./TopNav.module.css";

const NAV_ITEMS: { href: string; label: string; group: "plan" | "ressurs" | "admin" }[] = [
  { href: "/plan", label: "Plan", group: "plan" },
  { href: "/masterplan", label: "Masterplan", group: "plan" },
  { href: "/ansatte", label: "Ansatte", group: "ressurs" },
  { href: "/biler", label: "Biler", group: "ressurs" },
  { href: "/verksted", label: "Verksted", group: "ressurs" },
  { href: "/henger", label: "Hengere", group: "ressurs" },
  { href: "/fravaer", label: "Fravær", group: "admin" },
  { href: "/innstillinger", label: "Innstillinger", group: "admin" },
];

export default function TopNav() {
  const pathname = usePathname();
  const { profile, configured, loading } = useAuth();

  const displayName =
    profile?.display_name?.trim() ||
    profile?.email?.split("@")[0] ||
    (loading ? "…" : null);

  return (
    <div className={styles.navWrap}>
      <nav className={styles.nav} aria-label="Hovedmeny">
        <Link href="/" className={styles.brand}>
          <KoordinateLogo size={30} className={styles.brandLogo} />
          <span className={styles.brandText}>
            <span className={styles.brandKo}>KO</span>
            <span className={styles.brandOrdinate}>ordinate</span>
          </span>
        </Link>

        <div className={styles.divider} />

        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/biler" && pathname.startsWith(item.href + "/"));
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

        <GlobalSøk />

        <div className={styles.spacer} />

        {configured && profile ? (
          <div className={styles.userBlock}>
            <span className={styles.userName} title={profile.email ?? undefined}>
              {displayName}
            </span>
            <span className={styles.roleBadge}>{roleLabel(profile.role)}</span>
            <form action={signOut}>
              <button className={styles.logoutBtn} type="submit">
                Logg ut
              </button>
            </form>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
