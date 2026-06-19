import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole, UserProfile } from "./types";

function tilAppRole(role: unknown): AppRole {
  if (role === "admin" || role === "planlegger" || role === "visning") {
    return role;
  }
  return "visning";
}

/** Hent profil fra profiles-tabellen; faller tilbake til visning ved manglende rad/feil. */
export async function hentProfilForBruker(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[auth] Kunne ikke hente profil:", error.message);
  }

  if (!data) {
    return {
      id: userId,
      email,
      display_name: null,
      role: "visning",
    };
  }

  return {
    id: data.id,
    email: data.email,
    display_name: data.display_name,
    role: tilAppRole(data.role),
  };
}
