import { isSupabaseConfigured } from "@/lib/supabase/env";
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
          <span className={styles.brandIcon}>KO</span>
          <span className={styles.title}>KOordinate</span>
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
          <LoginForm nextPath={nextPath} />
        )}
      </div>
    </main>
  );
}
