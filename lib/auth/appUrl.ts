/**
 * Kanonisk app-URL for e-postinvitasjoner og OAuth redirect.
 * Sett NEXT_PUBLIC_APP_URL i produksjon (f.eks. https://koordinate.dittdomene.no).
 */
export function getAppOrigin(): string {
  const fraEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fraEnv) return fraEnv;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

/** Full callback-URL for Supabase Auth (invite, magic link, OAuth). */
export function getAuthCallbackUrl(nextPath = "/"): string {
  const next = nextPath.startsWith("/") ? nextPath : "/";
  return `${getAppOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}
