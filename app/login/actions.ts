"use server";

import { tryggRedirectPath } from "@/lib/auth/tryggRedirectPath";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";

export type LoginState = { error?: string };

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase er ikke konfigurert. Kontakt administrator." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Fyll inn e-post og passord." };
  }

  const supabase = await createClient();
  let signInError: { message: string; status?: number } | null = null;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    signInError = error;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/fetch failed|network|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
      return {
        error:
          "Kunne ikke nå innloggingstjenesten. Sjekk nettverk/VPN og prøv igjen.",
      };
    }
    return { error: "Innlogging feilet. Prøv igjen." };
  }

  if (signInError) {
    return { error: "Feil e-post eller passord." };
  }

  redirect(tryggRedirectPath(String(formData.get("next") ?? "")));
}

export async function signOut() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
