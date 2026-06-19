"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  hentAppUrlForAdminAction,
  hentInfoskjermConfigAction,
  importerBrukereFraSupabaseAction,
  genererPassordLenkeUrlAction,
  sendPassordLenkeAction,
  inviterBrukerAction,
  listBrukereAction,
  oppdaterBrukerRolleAction,
  type BrukerRad,
} from "@/app/actions/userAdmin";
import { roleLabel, type AppRole } from "@/lib/auth/types";
import { useAuth } from "@/lib/state/authStore";
import styles from "../page.module.css";

const ROLLER: AppRole[] = ["admin", "planlegger", "visning"];

export default function BrukerePage() {
  const { profile } = useAuth();
  const [brukere, setBrukere] = useState<BrukerRad[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [laster, setLaster] = useState(true);
  const [sender, setSender] = useState(false);
  const [importerer, setImporterer] = useState(false);
  const [urlInfo, setUrlInfo] = useState<{
    origin: string;
    callbackUrl: string;
    confirmUrl: string;
    inviteMal: string;
    recoveryMal: string;
  } | null>(null);
  const [senderPassordLenke, setSenderPassordLenke] = useState<string | null>(null);
  const [kopiererLenke, setKopiererLenke] = useState<string | null>(null);
  const [infoskjermUrl, setInfoskjermUrl] = useState<string | null>(null);
  const [infoskjermFeil, setInfoskjermFeil] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rolle, setRolle] = useState<AppRole>("planlegger");

  async function lastInn() {
    setLaster(true);
    const result = await listBrukereAction();
    if ("error" in result) {
      setStatus(result.error);
      setBrukere([]);
    } else {
      setBrukere(result.brukere);
    }
    setLaster(false);
  }

  useEffect(() => {
    void lastInn();
    void hentAppUrlForAdminAction().then(setUrlInfo).catch(() => setUrlInfo(null));
    void hentInfoskjermConfigAction().then((r) => {
      if ("url" in r) {
        setInfoskjermUrl(r.url);
        setInfoskjermFeil(null);
      } else {
        setInfoskjermFeil(r.error);
      }
    });
  }, []);

  async function kopierPassordLenke(epost: string) {
    setKopiererLenke(epost);
    setStatus(null);
    try {
      const result = await genererPassordLenkeUrlAction(epost);
      if ("error" in result) {
        setStatus(result.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
        setStatus(
          `Passordlenke kopiert for ${epost}. Send i Teams — kollegaen må klikke «Fortsett til passordvalg» på siden som åpnes.`,
        );
      } catch {
        setStatus(`Kopier denne lenken manuelt: ${result.url}`);
      }
    } finally {
      setKopiererLenke(null);
    }
  }

  async function sendPassordLenke(epost: string) {
    setSenderPassordLenke(epost);
    setStatus(null);
    try {
      const result = await sendPassordLenkeAction(epost);
      if ("error" in result) {
        setStatus(result.error);
      } else {
        setStatus(`Passordlenke sendt til ${epost}. Kollegaen kan sette passord via e-posten.`);
      }
    } finally {
      setSenderPassordLenke(null);
    }
  }

  async function sendInvitasjon(e: React.FormEvent) {
    e.preventDefault();
    setSender(true);
    setStatus(null);
    try {
      const result = await Promise.race([
        inviterBrukerAction({
          email,
          display_name: displayName,
          role: rolle,
        }),
        new Promise<{ error: string }>((resolve) => {
          window.setTimeout(
            () =>
              resolve({
                error:
                  "Forespørselen tok for lang tid (over 45 s). Sjekk at SUPABASE_SERVICE_ROLE_KEY er satt i Vercel og at du har redeployet.",
              }),
            45_000,
          );
        }),
      ]);
      if ("error" in result) {
        setStatus(result.error);
      } else {
        setStatus(
          `Invitasjon sendt til ${email.trim().toLowerCase()}. Sjekk innboks og søppelpost — e-post sendes fra Supabase, ikke fra appen.`,
        );
        setEmail("");
        setDisplayName("");
        void lastInn();
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Invitasjon feilet");
    } finally {
      setSender(false);
    }
  }

  async function endreRolle(brukerId: string, nyRolle: AppRole) {
    setStatus(null);
    const result = await oppdaterBrukerRolleAction(brukerId, nyRolle);
    if ("error" in result) {
      setStatus(result.error);
    } else {
      setStatus(
        "Rolle oppdatert. Be brukeren logge ut og inn igjen (eller laste siden på nytt) for at endringen skal gjelde.",
      );
      await lastInn();
    }
  }

  async function importerFraSupabase() {
    setImporterer(true);
    setStatus(null);
    const result = await importerBrukereFraSupabaseAction();
    if ("error" in result) {
      setStatus(result.error);
    } else {
      const deler = [`${result.importert} nye profiler opprettet`];
      if (result.oppdatert > 0) {
        deler.push(`${result.oppdatert} oppdatert med e-post/navn`);
      }
      setStatus(
        `Synkronisert fra Supabase Auth (${result.totaltAuth} brukere): ${deler.join(", ")}.`,
      );
      await lastInn();
    }
    setImporterer(false);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>
            <Link href="/innstillinger">Innstillinger</Link> / Brukere
          </p>
          <h1 className={styles.title}>Brukere</h1>
          <p className={styles.lead}>
            Inviter nye brukere og velg rolle. Etter invitasjon settes passord på en egen side — ikke
            på innloggingssiden.
          </p>
        </div>
      </header>

      {urlInfo ? (
        <>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>URL for invitasjoner</h2>
            <p className={styles.muted}>
              Supabase → Authentication → URL Configuration. Bruk wildcard{" "}
              <code>{urlInfo.origin}/**</code> under Redirect URLs hvis du er usikker.
            </p>
            <dl className={styles.urlListe}>
              <div>
                <dt>Site URL (produksjon)</dt>
                <dd>
                  <code>{urlInfo.origin}</code>
                </dd>
              </div>
              <div>
                <dt>Redirect URL</dt>
                <dd>
                  <code>{urlInfo.callbackUrl}</code>
                </dd>
              </div>
              <div>
                <dt>Bekreftelses-URL</dt>
                <dd>
                  <code>{urlInfo.confirmUrl}</code>
                </dd>
              </div>
            </dl>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>E-postmaler i Supabase (viktig)</h2>
            <p className={styles.muted}>
              Uten dette får brukere «feil lenke». Gå til Authentication → Email Templates og
              erstatt lenken i hver mal med teksten under (behold øvrig tekst).
            </p>
            <p className={styles.muted}>
              <strong>Invite user</strong> og <strong>Reset password</strong> — lenken må peke til{" "}
              <code>/auth/aktiver</code> (ikke <code>/auth/confirm</code>). Lim inn:
            </p>
            <p>
              <code>{urlInfo.inviteMal}</code>
            </p>
            <p className={styles.muted}>
              Samme mal brukes for <strong>Reset password</strong> (med <code>type=recovery</code>
              ):
            </p>
            <p>
              <code>{urlInfo.recoveryMal}</code>
            </p>
            <p className={styles.hint}>
              Eksempel i HTML-mal:{" "}
              <code>
                {`<a href="${urlInfo.inviteMal}">Godta invitasjon og velg passord</a>`}
              </code>
            </p>
          </section>
        </>
      ) : null}

      {infoskjermUrl ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Infoskjerm (Infoskjermen.no)</h2>
          <p className={styles.muted}>
            Lim inn som «Nettside»-oppslag. Oppdateres automatisk hvert 45. sekund.
          </p>
          <p>
            <code>{infoskjermUrl}</code>
          </p>
        </section>
      ) : infoskjermFeil ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Infoskjerm (Infoskjermen.no)</h2>
          <p className={styles.status}>{infoskjermFeil}</p>
          <p className={styles.muted}>
            Legg til <code>INFOSKJERM_TOKEN</code> under Vercel → Project → Settings → Environment
            Variables (Production), deretter Redeploy.
          </p>
        </section>
      ) : null}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Send invitasjon</h2>
        <form className={styles.formGrid} onSubmit={(e) => void sendInvitasjon(e)}>
          <label className={styles.field}>
            <span>E-post</span>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="navn@firma.no"
            />
          </label>
          <label className={styles.field}>
            <span>Visningsnavn</span>
            <input
              className={styles.input}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="Fornavn Etternavn"
            />
          </label>
          <label className={styles.field}>
            <span>Rolle</span>
            <select
              className={styles.input}
              value={rolle}
              onChange={(e) => setRolle(e.target.value as AppRole)}
            >
              {ROLLER.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.formActions}>
            <button className={styles.primaryBtn} type="submit" disabled={sender}>
              {sender ? "Sender …" : "Send invitasjon"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.cardTitle}>Registrerte brukere</h2>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={importerer || laster}
            onClick={() => void importerFraSupabase()}
          >
            {importerer ? "Importerer …" : "Importer fra Supabase"}
          </button>
        </div>
        <p className={styles.muted}>
          Henter brukere fra Supabase Authentication som mangler profil i appen. Eksisterende
          roller endres ikke — nye brukere får visning som standard.
        </p>
        {laster ? (
          <p className={styles.muted}>Henter …</p>
        ) : brukere.length === 0 ? (
          <p className={styles.muted}>Ingen brukere funnet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Navn</th>
                <th>E-post</th>
                <th>Rolle</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {brukere.map((b) => (
                <tr key={b.id}>
                  <td>{b.display_name ?? "—"}</td>
                  <td>{b.email ?? "—"}</td>
                  <td>
                    <select
                      className={styles.input}
                      value={b.role}
                      disabled={b.id === profile?.id}
                      onChange={(e) => void endreRolle(b.id, e.target.value as AppRole)}
                    >
                      {ROLLER.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {b.email && b.id !== profile?.id ? (
                      <div className={styles.handlinger}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          disabled={senderPassordLenke === b.email}
                          onClick={() => void sendPassordLenke(b.email!)}
                        >
                          {senderPassordLenke === b.email ? "Sender …" : "Send e-post"}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          disabled={kopiererLenke === b.email}
                          onClick={() => void kopierPassordLenke(b.email!)}
                        >
                          {kopiererLenke === b.email ? "Kopierer …" : "Kopier passordlenke"}
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {status ? <p className={styles.status}>{status}</p> : null}
    </div>
  );
}
