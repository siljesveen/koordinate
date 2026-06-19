import { describe, expect, it } from "vitest";
import {
  countKoblingsgrupper,
  grunnTilUploadBlokkering,
  harMeningsfulltInnhold,
} from "./skyUploadGuard";

const MASTERPLAN_KEY = "bemanning.masterplan.v1";

describe("harMeningsfulltInnhold", () => {
  it("ser array med elementer som meningsfullt", () => {
    expect(harMeningsfulltInnhold("bemanning.ansatte.v2", [{ id: "1" }])).toBe(true);
    expect(harMeningsfulltInnhold("bemanning.ansatte.v2", [])).toBe(false);
  });

  it("ser masterplan med slots som meningsfullt", () => {
    expect(
      harMeningsfulltInnhold(MASTERPLAN_KEY, { slots: [{ id: "s1" }] }),
    ).toBe(true);
  });

  it("ser masterplan med koblingsgrupper som meningsfullt når slots-felt mangler", () => {
    expect(
      harMeningsfulltInnhold(MASTERPLAN_KEY, {
        koblingsgrupper: { gruppe1: { rutekoder: ["100", "200"] } },
      }),
    ).toBe(true);
  });

  it("tom slots-array regnes som tom selv med koblingsgrupper", () => {
    expect(
      harMeningsfulltInnhold(MASTERPLAN_KEY, {
        slots: [],
        koblingsgrupper: { gruppe1: { rutekoder: ["100", "200"] } },
      }),
    ).toBe(false);
  });
});

describe("countKoblingsgrupper", () => {
  it("teller koblingsgrupper i masterplan", () => {
    expect(
      countKoblingsgrupper({
        koblingsgrupper: {
          a: { rutekoder: ["1", "2"] },
          b: { rutekoder: ["3", "4"] },
        },
      }),
    ).toBe(2);
  });
});

describe("grunnTilUploadBlokkering", () => {
  it("blokkerer når lokal data er tom men sky har innhold", () => {
    const reason = grunnTilUploadBlokkering(
      "bemanning.ansatte.v2",
      [],
      { key: "bemanning.ansatte.v2", value: [{ id: "1" }], updatedAt: "2026-01-01T00:00:00Z" },
      undefined,
    );
    expect(reason).toBe("tom_lokal");
  });

  it("blokkerer når sky er nyere enn lokal meta", () => {
    const reason = grunnTilUploadBlokkering(
      "bemanning.ansatte.v2",
      [{ id: "1" }],
      { key: "bemanning.ansatte.v2", value: [{ id: "1" }], updatedAt: "2026-06-01T00:00:00Z" },
      "2026-01-01T00:00:00Z",
    );
    expect(reason).toBe("sky_nyere");
  });

  it("blokkerer masterplan-opplasting med færre koblingsgrupper", () => {
    const reason = grunnTilUploadBlokkering(
      MASTERPLAN_KEY,
      { slots: [{ id: "s1" }], koblingsgrupper: { g1: { rutekoder: ["1", "2"] } } },
      {
        key: MASTERPLAN_KEY,
        value: {
          slots: [{ id: "s1" }],
          koblingsgrupper: {
            g1: { rutekoder: ["1", "2"] },
            g2: { rutekoder: ["3", "4"] },
          },
        },
        updatedAt: "2026-01-01T00:00:00Z",
      },
      "2026-06-01T00:00:00Z",
    );
    expect(reason).toBe("færre_koblingsgrupper");
  });

  it("returnerer null når opplasting er trygg", () => {
    const reason = grunnTilUploadBlokkering(
      "bemanning.ansatte.v2",
      [{ id: "1" }],
      { key: "bemanning.ansatte.v2", value: [{ id: "1" }], updatedAt: "2026-01-01T00:00:00Z" },
      "2026-06-01T00:00:00Z",
    );
    expect(reason).toBeNull();
  });
});
