import { describe, expect, it, vi } from "vitest";
import { hentProfilForBruker } from "./hentProfil";

describe("hentProfilForBruker", () => {
  it("returnerer admin-rolle fra profiles", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "u1",
                email: "admin@test.no",
                display_name: "Admin",
                role: "admin",
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const profil = await hentProfilForBruker(supabase as never, "u1", "admin@test.no");
    expect(profil.role).toBe("admin");
  });

  it("faller tilbake til visning ved manglende rad", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    const profil = await hentProfilForBruker(supabase as never, "u1", "admin@test.no");
    expect(profil.role).toBe("visning");
  });

  it("logger og faller tilbake ved feil", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: "RLS" } }),
          }),
        }),
      }),
    };

    const profil = await hentProfilForBruker(supabase as never, "u1", "admin@test.no");
    expect(profil.role).toBe("visning");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
