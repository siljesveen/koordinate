import { describe, expect, it } from "vitest";
import { listAlleAuthBrukere, visningsnavnFraAuthBruker } from "./authBrukerUtils";

describe("visningsnavnFraAuthBruker", () => {
  it("bruker display_name fra metadata", () => {
    expect(
      visningsnavnFraAuthBruker({
        email: "a@b.no",
        user_metadata: { display_name: "Ola Nord" },
      }),
    ).toBe("Ola Nord");
  });

  it("faller tilbake til e-postlokaldel", () => {
    expect(visningsnavnFraAuthBruker({ email: "ola@firma.no", user_metadata: {} })).toBe("ola");
  });
});

describe("listAlleAuthBrukere", () => {
  it("henter alle sider", async () => {
    const kall: number[] = [];
    const brukere = await listAlleAuthBrukere(async (page, perPage) => {
      kall.push(page);
      if (page === 1) {
        return {
          users: Array.from({ length: perPage }, (_, i) => ({ id: String(i) })),
          error: null,
        };
      }
      return { users: [{ id: "siste" }], error: null };
    });

    expect(kall).toEqual([1, 2]);
    expect(brukere).toHaveLength(201);
  });
});
