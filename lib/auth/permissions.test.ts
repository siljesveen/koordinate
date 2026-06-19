import { describe, expect, it } from "vitest";
import {
  canAccessHref,
  canAccessPath,
  canEditAppDataKey,
  canEditMasterdata,
  navItemsForRole,
} from "./permissions";

describe("canAccessPath", () => {
  it("alle roller ser dashboard", () => {
    for (const role of ["admin", "planlegger", "visning"] as const) {
      expect(canAccessPath(role, "/")).toBe(true);
    }
  });

  it("planlegger ser ansatte/biler/henger men ikke masterplan", () => {
    expect(canAccessPath("planlegger", "/ansatte")).toBe(true);
    expect(canAccessPath("planlegger", "/biler")).toBe(true);
    expect(canAccessPath("planlegger", "/henger")).toBe(true);
    expect(canAccessPath("planlegger", "/masterplan")).toBe(false);
    expect(canAccessPath("planlegger", "/innstillinger")).toBe(false);
  });

  it("visning ser drift men ikke stamdata", () => {
    expect(canAccessPath("visning", "/plan")).toBe(true);
    expect(canAccessPath("visning", "/fravaer")).toBe(true);
    expect(canAccessPath("visning", "/ansatte")).toBe(false);
    expect(canAccessPath("visning", "/masterplan")).toBe(false);
  });

  it("admin ser alt i nav", () => {
    expect(canAccessPath("admin", "/innstillinger")).toBe(true);
    expect(canAccessPath("admin", "/masterplan")).toBe(true);
  });
});

describe("navItemsForRole", () => {
  it("planlegger får stamdata-sider uten masterplan", () => {
    const hrefs = navItemsForRole("planlegger").map((i) => i.href);
    expect(hrefs).toContain("/ansatte");
    expect(hrefs).not.toContain("/masterplan");
  });
});

describe("canEditMasterdata", () => {
  it("kun admin kan redigere stamdata", () => {
    expect(canEditMasterdata("admin")).toBe(true);
    expect(canEditMasterdata("planlegger")).toBe(false);
    expect(canEditMasterdata("visning")).toBe(false);
  });
});

describe("canEditAppDataKey", () => {
  it("planlegger kan skrive plan men ikke ansatte", () => {
    expect(canEditAppDataKey("planlegger", "bemanning.planRuteTildeling.v2")).toBe(true);
    expect(canEditAppDataKey("planlegger", "bemanning.ansatte.v2")).toBe(false);
    expect(canEditAppDataKey("admin", "bemanning.ansatte.v2")).toBe(true);
  });

  it("visning kan ikke skrive noe", () => {
    expect(canEditAppDataKey("visning", "bemanning.fravaer.v1")).toBe(false);
  });
});

describe("canAccessHref", () => {
  it("respekterer query-streng", () => {
    expect(canAccessHref("planlegger", "/ansatte?søk=test")).toBe(true);
    expect(canAccessHref("visning", "/ansatte?søk=test")).toBe(false);
  });
});
