"use client";

import KoordinateLogo from "@/components/KoordinateLogo";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { aktiverEpostLenkeAction } from "./actions";
import styles from "../../login/page.module.css";

const GYLDIGE_TYPER = new Set<string>(["invite", "recovery", "signup", "magiclink", "email"]);

function AktiverInnhold() {
  const searchParams = useSearchParams();
  const token_hash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = searchParams.get("next") ?? "/auth/sett-passord";
  const type = typeParam && GYLDIGE_TYPER.has(typeParam) ? (typeParam as EmailOtpType) : null;

  const [feil, setFeil] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const mangler = !token_hash || !type;

  async function handleAktiver() {
    if (!token_hash || !type) return;
    setPending(true);
    setFeil(null);
    try {
      const result = await aktiverEpostLenkeAction(token_hash, type, next);
      if (result?.error) {
        setFeil(result.error);
        setPending(false);
      }
    } catch {
      setFeil("Noe gikk galt. Prøv igjen eller be om ny lenke.");
      setPending(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <KoordinateLogo size={36} />
          <div>
            <div className={styles.brandText}>
              <span className={styles.brandKo}>KO</span>
              <span className={styles.brandOrdinate}>ordinate</span>
            </div>
          </div>
        </div>

        <h1 className={styles.title}>Aktiver kontoen din</h1>

        {mangler ? (
          <p className={styles.sub}>
            Lenken er ufullstendig. Be administrator om ny invitasjon eller passordlenke.
          </p>
        ) : (
          <>
            <p className={styles.sub}>
              Klikk knappen under for å fortsette til passordvalg. Dette steget beskytter mot at
              e-postprogram (f.eks. Outlook) «bruker» lenken før du rekker å åpne den.
            </p>
            {feil ? <div className={styles.error}>{feil}</div> : null}
            <button
              type="button"
              className={styles.submit}
              disabled={pending}
              onClick={() => void handleAktiver()}
            >
              {pending ? "Aktiverer …" : "Fortsett til passordvalg"}
            </button>
          </>
        )}

        <p className={styles.hint}>
          Får du feil om utløpt lenke? Be om ny lenke via Teams — ikke åpne den gamle e-posten på
          nytt.
        </p>
      </div>
    </main>
  );
}

export default function AktiverLenkeClient() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <p className={styles.hint}>Laster …</p>
        </main>
      }
    >
      <AktiverInnhold />
    </Suspense>
  );
}
