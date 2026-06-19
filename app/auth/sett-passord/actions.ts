"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";

export type SettPassordState = { error?: string };

const MIN_LENGDE = 8;

export async function settPassord(
  _prev: SettPassordState,
  formData: FormData,
): Promise<SettPassordState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase er ikke konfigurert." };
  }

  const passord = String(formData.get("password") ?? "");
  const bekreft = String(formData.get("confirm") ?? "");

  if (!passord || !bekreft) {
    return { error: "Fyll inn begge passordfeltene." };
  }
  if (passord.length < MIN_LENGDE) {
    return { error: `Passordet må være minst ${MIN_LENGDE} tegn.` };
  }
  if (passord !== bekreft) {
    return { error: "Passordene er ikke like." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Sesjonen er utløpt. Åpne lenken fra invitasjons- eller passord-e-posten på nytt.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: passord });
  if (error) {
    return { error: error.message };
  }

  redirect("/");
}
