"use server";

import { getAppOrigin, getAuthCallbackUrl } from "@/lib/auth/appUrl";
import { listAlleAuthBrukere, visningsnavnFraAuthBruker } from "@/lib/auth/authBrukerUtils";
import { isAdmin, type AppRole, type UserProfile } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

export type BrukerRad = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: AppRole;
  created_at: string;
};

async function krevAdmin(): Promise<UserProfile> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase er ikke konfigurert");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Ikke innlogget");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const rolle = (profile?.role ?? "visning") as AppRole;
  if (!isAdmin(rolle)) {
    throw new Error("Kun administrator har tilgang");
  }

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? null,
    display_name: profile?.display_name ?? null,
    role: rolle,
  };
}

export async function listBrukereAction(): Promise<
  { brukere: BrukerRad[] } | { error: string }
> {
  try {
    await krevAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, display_name, role, created_at")
      .order("created_at", { ascending: true });

    if (error) return { error: error.message };

    return {
      brukere: (data ?? []).map((r) => ({
        id: r.id,
        email: r.email,
        display_name: r.display_name,
        role: r.role as AppRole,
        created_at: r.created_at,
      })),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Kunne ikke hente brukere" };
  }
}

export type ImporterBrukereResult = {
  importert: number;
  oppdatert: number;
  totaltAuth: number;
  totaltProfiler: number;
};

/** Oppretter manglende profiler for brukere som finnes i Supabase Auth. Eksisterende roller endres ikke. */
export async function importerBrukereFraSupabaseAction(): Promise<
  ImporterBrukereResult | { error: string }
> {
  try {
    await krevAdmin();
    const admin = createAdminClient();

    const authBrukere = await listAlleAuthBrukere(async (page, perPage) => {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      return { users: data?.users ?? [], error: error ? new Error(error.message) : null };
    });

    const { data: profiler, error: profilError } = await admin
      .from("profiles")
      .select("id, email, display_name");

    if (profilError) return { error: profilError.message };

    const profilById = new Map((profiler ?? []).map((p) => [p.id, p]));
    let importert = 0;
    let oppdatert = 0;

    for (const bruker of authBrukere) {
      const email = bruker.email?.trim().toLowerCase() || null;
      const displayName = visningsnavnFraAuthBruker(bruker);
      const eksisterende = profilById.get(bruker.id);

      if (!eksisterende) {
        const { error } = await admin.from("profiles").insert({
          id: bruker.id,
          email,
          display_name: displayName,
          role: "visning",
        });
        if (error) return { error: error.message };
        importert += 1;
        continue;
      }

      const manglerEmail = !eksisterende.email && email;
      const manglerNavn = !eksisterende.display_name?.trim();
      if (!manglerEmail && !manglerNavn) continue;

      const { error } = await admin
        .from("profiles")
        .update({
          ...(manglerEmail ? { email } : {}),
          ...(manglerNavn ? { display_name: displayName } : {}),
        })
        .eq("id", bruker.id);

      if (error) return { error: error.message };
      oppdatert += 1;
    }

    revalidatePath("/innstillinger/brukere");
    return {
      importert,
      oppdatert,
      totaltAuth: authBrukere.length,
      totaltProfiler: profilById.size + importert,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import feilet" };
  }
}

export type InviterBrukerInput = {
  email: string;
  display_name: string;
  role: AppRole;
};

export async function inviterBrukerAction(
  input: InviterBrukerInput,
): Promise<{ ok: true } | { error: string }> {
  try {
    const adminProfil = await krevAdmin();
    const email = input.email.trim().toLowerCase();
    const displayName = input.display_name.trim();

    if (!email || !email.includes("@")) {
      return { error: "Ugyldig e-postadresse" };
    }
    if (!displayName) {
      return { error: "Visningsnavn er påkrevd" };
    }
    if (input.role !== "admin" && input.role !== "planlegger" && input.role !== "visning") {
      return { error: "Ugyldig rolle" };
    }

    const admin = createAdminClient();
    const redirectTo = getAuthCallbackUrl("/");

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { display_name: displayName },
        redirectTo,
      },
    );

    if (inviteError) {
      return { error: inviteError.message };
    }

    const userId = inviteData.user?.id;
    if (!userId) {
      return { error: "Invitasjon sendt, men bruker-id manglet i svar" };
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: input.role,
        display_name: displayName,
        email,
      })
      .eq("id", userId);

    if (profileError) {
      return {
        error: `Invitasjon sendt til ${email}, men rolle kunne ikke settes: ${profileError.message}`,
      };
    }

    if (userId === adminProfil.id && input.role !== "admin") {
      return { error: "Du kan ikke degradere deg selv til en lavere rolle" };
    }

    revalidatePath("/innstillinger/brukere");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invitasjon feilet" };
  }
}

export async function oppdaterBrukerRolleAction(
  brukerId: string,
  role: AppRole,
): Promise<{ ok: true } | { error: string }> {
  try {
    const adminProfil = await krevAdmin();

    if (brukerId === adminProfil.id && role !== "admin") {
      return { error: "Du kan ikke fjerne admin-tilgang fra deg selv" };
    }

    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({ role }).eq("id", brukerId);

    if (error) return { error: error.message };

    revalidatePath("/innstillinger/brukere");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Kunne ikke oppdatere rolle" };
  }
}

export async function hentInfoskjermConfigAction(): Promise<
  { url: string } | { error: string }
> {
  try {
    await krevAdmin();
    const token = process.env.INFOSKJERM_TOKEN?.trim();
    if (!token) {
      return { error: "INFOSKJERM_TOKEN er ikke satt i miljøvariabler" };
    }
    return { url: `${getAppOrigin()}/skjerm?token=${encodeURIComponent(token)}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Kunne ikke hente infoskjerm-URL" };
  }
}

export async function hentAppUrlForAdminAction(): Promise<{ origin: string; callbackUrl: string }> {
  await krevAdmin();
  return {
    origin: getAppOrigin(),
    callbackUrl: getAuthCallbackUrl("/"),
  };
}
