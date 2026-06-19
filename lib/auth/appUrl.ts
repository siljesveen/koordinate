function erGyldigAppOrigin(url: string | undefined): url is string {
  if (!url) return false;
  const u = url.trim();
  if (!u || u === "NEXT_PUBLIC_APP_URL") return false;
  return u.startsWith("http://") || u.startsWith("https://");
}

/**
 * Kanonisk app-URL for e-postinvitasjoner og OAuth redirect.
 * Sett NEXT_PUBLIC_APP_URL i produksjon (f.eks. https://koordinate.dittdomene.no).
 */
export function getAppOrigin(): string {
  const fraEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (erGyldigAppOrigin(fraEnv)) return fraEnv;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

/** PKCE callback — uten query i path (matcher enklere i Supabase allow-list). */
export function getAuthCallbackUrl(): string {
  return `${getAppOrigin()}/auth/callback`;
}

/** E-postlenker med token_hash (anbefalt for invitasjon og passordlenke). */
export function getAuthConfirmUrl(nextPath = "/auth/sett-passord"): string {
  const next = nextPath.startsWith("/") ? nextPath : "/auth/sett-passord";
  return `${getAppOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/** Tekst til Supabase e-postmaler (Authentication → Email Templates). */
export function supabaseEpostMal(type: "invite" | "recovery"): string {
  const next = encodeURIComponent("/auth/sett-passord");
  const otpType = type === "invite" ? "invite" : "recovery";
  return `{{ .SiteURL }}/auth/aktiver?token_hash={{ .TokenHash }}&type=${otpType}&next=${next}`;
}
