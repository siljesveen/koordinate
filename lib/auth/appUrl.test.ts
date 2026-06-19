import { describe, expect, it, vi } from "vitest";
import { getAppOrigin, getAuthCallbackUrl } from "./appUrl";

describe("getAppOrigin", () => {
  it("bruker NEXT_PUBLIC_APP_URL når satt", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://koordinate.example.com/");
    expect(getAppOrigin()).toBe("https://koordinate.example.com");
    vi.unstubAllEnvs();
  });
});

describe("getAuthCallbackUrl", () => {
  it("bygger callback med next-parameter", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://koordinate.example.com");
    expect(getAuthCallbackUrl("/plan")).toBe(
      "https://koordinate.example.com/auth/callback?next=%2Fplan",
    );
    vi.unstubAllEnvs();
  });
});
