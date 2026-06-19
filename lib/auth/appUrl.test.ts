import { describe, expect, it, vi } from "vitest";
import { getAppOrigin, getAuthCallbackUrl, getAuthConfirmUrl, supabaseEpostMal } from "./appUrl";

describe("getAppOrigin", () => {
  it("bruker NEXT_PUBLIC_APP_URL når satt", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://koordinate.example.com/");
    expect(getAppOrigin()).toBe("https://koordinate.example.com");
    vi.unstubAllEnvs();
  });

  it("ignorerer feilaktig verdi som bare er variabelnavnet", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_APP_URL");
    vi.stubEnv("VERCEL_URL", "koordinate-two.vercel.app");
    expect(getAppOrigin()).toBe("https://koordinate-two.vercel.app");
    vi.unstubAllEnvs();
  });
});

describe("getAuthCallbackUrl", () => {
  it("bygger callback uten query (allow-list-vennlig)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://koordinate.example.com");
    expect(getAuthCallbackUrl()).toBe("https://koordinate.example.com/auth/callback");
    vi.unstubAllEnvs();
  });
});

describe("getAuthConfirmUrl", () => {
  it("bygger confirm med next til sett-passord", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://koordinate.example.com");
    expect(getAuthConfirmUrl()).toBe(
      "https://koordinate.example.com/auth/confirm?next=%2Fauth%2Fsett-passord",
    );
    vi.unstubAllEnvs();
  });
});

describe("supabaseEpostMal", () => {
  it("inneholder token_hash og type for invitasjon", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://koordinate.example.com");
    const mal = supabaseEpostMal("invite");
    expect(mal).toContain("/auth/aktiver?token_hash={{ .TokenHash }}");
    expect(mal).toContain("type=invite");
    vi.unstubAllEnvs();
  });
});
