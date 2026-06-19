import type { AppDataKey } from "@/lib/data/storageKeys";
import type { AppRole } from "./types";
import { canEditData, canEditMasterdata, isAdmin } from "./types";

export type NavGroup = "drift" | "stamdata" | "system";

export type NavItem = {
  href: string;
  label: string;
  group: NavGroup;
  /** Roller som kan åpne siden (les eller rediger). */
  roles: readonly AppRole[];
};

/** Hovedmeny — rekkefølge er visningsrekkefølge. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/plan", label: "Plan", group: "drift", roles: ["admin", "planlegger", "visning"] },
  { href: "/hentinger", label: "Hentinger", group: "drift", roles: ["admin", "planlegger", "visning"] },
  { href: "/fravaer", label: "Fravær", group: "drift", roles: ["admin", "planlegger", "visning"] },
  { href: "/verksted", label: "Verksted", group: "drift", roles: ["admin", "planlegger", "visning"] },
  { href: "/masterplan", label: "Masterplan", group: "stamdata", roles: ["admin"] },
  { href: "/ansatte", label: "Ansatte", group: "stamdata", roles: ["admin", "planlegger"] },
  { href: "/biler", label: "Biler", group: "stamdata", roles: ["admin", "planlegger"] },
  { href: "/henger", label: "Hengere", group: "stamdata", roles: ["admin", "planlegger"] },
  { href: "/innstillinger", label: "Innstillinger", group: "system", roles: ["admin"] },
] as const;

/** Stamdata i sky/lokal lagring — kun admin kan skrive. */
export const MASTERDATA_APP_DATA_KEYS: readonly AppDataKey[] = [
  "bemanning.ansatte.v2",
  "bemanning.biler.v1",
  "bemanning.henger.v1",
  "bemanning.masterplan.v1",
] as const;

const MASTERDATA_KEY_SET = new Set<string>(MASTERDATA_APP_DATA_KEYS);

/** Ekstra ruter uten nav-fane som autentiserte brukere kan åpne. */
const EXTRA_ACCESS: { prefix: string; roles: readonly AppRole[] }[] = [
  { prefix: "/dashboard-preview", roles: ["admin", "planlegger", "visning"] },
];

export { canEditMasterdata } from "./types";

export function canEditAppDataKey(role: AppRole, key: AppDataKey): boolean {
  if (!canEditData(role)) return false;
  if (MASTERDATA_KEY_SET.has(key)) return isAdmin(role);
  return true;
}

export function navItemsForRole(role: AppRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

function finnNavItemForPath(path: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => path === item.href || (item.href !== "/" && path.startsWith(`${item.href}/`)),
  );
}

export function canAccessPath(role: AppRole, path: string): boolean {
  if (path === "/") return true;

  const navItem = finnNavItemForPath(path);
  if (navItem) return navItem.roles.includes(role);

  for (const extra of EXTRA_ACCESS) {
    if (path === extra.prefix || path.startsWith(`${extra.prefix}/`)) {
      return extra.roles.includes(role);
    }
  }

  return false;
}

/** Sjekk om en søkelenke peker til en side brukeren har tilgang til. */
export function canAccessHref(role: AppRole, href: string): boolean {
  const path = href.split("?")[0] ?? href;
  return canAccessPath(role, path);
}
