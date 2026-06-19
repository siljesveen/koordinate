import { describe, expect, it } from "vitest";
import { tryggRedirectPath } from "./tryggRedirectPath";

describe("tryggRedirectPath", () => {
  it("tillater vanlige interne stier", () => {
    expect(tryggRedirectPath("/plan")).toBe("/plan");
    expect(tryggRedirectPath("/ansatte?vis=1")).toBe("/ansatte?vis=1");
  });

  it("fallback til / ved tom eller ugyldig input", () => {
    expect(tryggRedirectPath("")).toBe("/");
    expect(tryggRedirectPath(null)).toBe("/");
    expect(tryggRedirectPath(undefined)).toBe("/");
    expect(tryggRedirectPath("plan")).toBe("/");
    expect(tryggRedirectPath("https://evil.com")).toBe("/");
  });

  it("blokkerer protocol-relative redirect", () => {
    expect(tryggRedirectPath("//evil.com")).toBe("/");
    expect(tryggRedirectPath("//evil.com/path")).toBe("/");
  });

  it("blokkerer backslash-tricks", () => {
    expect(tryggRedirectPath("/\\evil.com")).toBe("/");
    expect(tryggRedirectPath("/plan\\..\\admin")).toBe("/");
  });
});
