import { isSupabaseConfigured } from "@/lib/supabase/env";
import KoordinateLogo from "@/components/KoordinateLogo";
import { LoginForm } from "./LoginForm";
import styles from "./page.module.css";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") ? params.next : "/";
  const authError = params.error === "auth";
  const configured = isSupabaseConfigured();

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

        <p className={styles.sub}>Logg inn for å bruke planleggingsverktøyet.</p>

        {authError ? (
          <p className={styles.error}>Innlogging feilet. Prøv igjen.</p>
        ) : null}

        {!configured ? (
          <p className={styles.hint}>
            Supabase er ikke konfigurert ennå. Legg inn{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> og{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> i <code>.env.local</code>{" "}
            (lokalt) og under Environment Variables på Vercel.
          </p>
        ) : (
          <>
            <p className={styles.hint}>
              Får du ikke logget inn? Tøm informasjonskapsler for{" "}
              <code>localhost</code> (søk etter <code>sb-</code> i nettleseren) og
              prøv på nytt.
            </p>
            <LoginForm nextPath={nextPath} />
          </>
        )}
      </div>
    </main>
  );
}
