/**
 * Validerer intern redirect-sti etter innlogging.
 * Blokkerer protocol-relative paths (//evil.com) og backslash-tricks.
 */
export function tryggRedirectPath(next: string | null | undefined): string {
  const trimmed = String(next ?? "").trim();
  if (!trimmed.startsWith("/")) return "/";
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return "/";
  if (trimmed.includes("\\")) return "/";
  return trimmed;
}
