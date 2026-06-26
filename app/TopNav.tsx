"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { signOut } from "@/app/login/actions";
import { navItemsForRole, type NavGroup, type NavItem } from "@/lib/auth/permissions";
import { roleLabel, type AppRole } from "@/lib/auth/types";
import KoordinateLogo from "@/components/KoordinateLogo";
import GlobalSøk from "@/components/GlobalSøk";
import { useAuth } from "@/lib/state/authStore";
import styles from "./TopNav.module.css";

function erAktiv(pathname: string, href: string): boolean {
  return (
    pathname === href || (href !== "/biler" && pathname.startsWith(`${href}/`))
  );
}

function renderNavItem(item: NavItem, pathname: string) {
  const isActive = erAktiv(pathname, item.href);
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
}

function grupperMedSkille(items: NavItem[]): { group: NavGroup | null; items: NavItem[] }[] {
  const result: { group: NavGroup | null; items: NavItem[] }[] = [];
  let forrige: NavGroup | null = null;

  for (const item of items) {
    if (item.group !== forrige) {
      result.push({ group: item.group, items: [item] });
      forrige = item.group;
    } else {
      result[result.length - 1]!.items.push(item);
    }
  }

  return result;
}

export default function TopNav() {
  const pathname = usePathname();
  const { profile, configured, loading } = useAuth();

  const role: AppRole = profile?.role ?? "visning";
  const synligeFaner = useMemo(() => navItemsForRole(role), [role]);
  const fanerMedGrupper = useMemo(() => grupperMedSkille(synligeFaner), [synligeFaner]);

  const displayName =
    profile?.display_name?.trim() ||
    profile?.email?.split("@")[0] ||
    (loading ? "…" : null);

  return (
    <div className={`${styles.navWrap} printHide`}>
      <div className={styles.navScroll}>
        <nav className={styles.nav} aria-label="Hovedmeny">
          <Link href="/" className={styles.brand}>
            <KoordinateLogo size={30} className={styles.brandLogo} />
            <span className={styles.brandText}>
              <span className={styles.brandKo}>KO</span>
              <span className={styles.brandOrdinate}>ordinate</span>
            </span>
          </Link>

          <div className={styles.divider} />

          {fanerMedGrupper.map((blokk, index) => (
            <span key={blokk.group ?? index} className={styles.navGroup}>
              {index > 0 ? <span className={styles.divider} aria-hidden /> : null}
              {blokk.items.map((item) => renderNavItem(item, pathname))}
            </span>
          ))}

          <GlobalSøk />
        </nav>
      </div>

      {configured ? (
        <div className={styles.userRail}>
          {profile ? (
            <>
              <span className={styles.userName} title={profile.email ?? undefined}>
                {displayName}
              </span>
              <span className={styles.roleBadge}>{roleLabel(profile.role)}</span>
            </>
          ) : (
            <span className={styles.userName} title="Henter brukerinfo">
              {loading ? "…" : "Bruker"}
            </span>
          )}
          <form action={signOut}>
            <button className={styles.logoutBtn} type="submit">
              Logg ut
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
