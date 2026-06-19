"use server";

import { tryggRedirectPath } from "@/lib/auth/tryggRedirectPath";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

function forklarVerifyFeil(melding: string): string {
  if (/expired|invalid|already been used|otp_expired/i.test(melding)) {
    return "Lenken er utløpt eller allerede brukt. Be administrator om ny lenke (bruk «Kopier passordlenke»). Åpne ikke lenken i forhåndsvisning i Outlook — klikk knappen på aktiveringssiden.";
  }
  return melding;
}

export async function aktiverEpostLenkeAction(
  token_hash: string,
  type: EmailOtpType,
  nextPath: string,
): Promise<{ error: string } | undefined> {
  if (!token_hash?.trim() || !type) {
    return { error: "Ugyldig lenke — mangler nødvendig informasjon." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: token_hash.trim(),
    type,
  });

  if (error) {
    return { error: forklarVerifyFeil(error.message) };
  }

  redirect(tryggRedirectPath(nextPath || "/auth/sett-passord"));
}
