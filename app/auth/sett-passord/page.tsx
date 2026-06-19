import KoordinateLogo from "@/components/KoordinateLogo";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AuthHashSession } from "./AuthHashSession";
import { SettPassordForm } from "./SettPassordForm";
import styles from "../../login/page.module.css";

export default async function SettPassordPage() {
  const configured = isSupabaseConfigured();
  let email: string | null = null;

  if (configured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
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
            <p className={styles.tagline}>Kommandosentral for bemanning og ruteplanlegging</p>
          </div>
        </div>

        <h1 className={styles.title}>Velg passord</h1>
        <AuthHashSession />

        {!configured ? (
          <p className={styles.hint}>Supabase er ikke konfigurert.</p>
        ) : email ? (
          <>
            <p className={styles.sub}>
              Velkommen{email ? `, ${email}` : ""}! Velg et passord du bruker neste gang du logger
              inn.
            </p>
            <SettPassordForm />
          </>
        ) : (
          <>
            <p className={styles.sub}>
              Åpne lenken fra invitasjons-e-posten eller passordlenken du fikk fra administrator.
              Du kan ikke sette passord fra innloggingssiden før du har åpnet den lenken.
            </p>
            <p className={styles.hint}>
              Har du allerede passord? Gå til{" "}
              <a href="/login">innlogging</a>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
