"use client";

import { useEffect, useState } from "react";
import type { InfoskjermOversikt } from "@/lib/plan/infoskjermOversikt";
import styles from "./page.module.css";

const OPPDATER_MS = 45_000;

function SkiftPanel({
  blokk,
}: {
  blokk: InfoskjermOversikt["dag"];
}) {
  return (
    <section className={styles.skiftPanel}>
      <header className={styles.skiftHead}>
        <h2 className={styles.skiftTitle}>{blokk.skift}</h2>
        <div className={styles.skiftStats}>
          <span className={styles.statOk}>{blokk.ruterOk} OK</span>
          <span className={styles.statMuted}>/ {blokk.ruterTotalt} ruter</span>
          {blokk.avvik > 0 ? (
            <span className={styles.statBad}>{blokk.avvik} avvik</span>
          ) : (
            <span className={styles.statOk}>Ingen avvik</span>
          )}
        </div>
      </header>

      <h3 className={styles.listTitle}>
        Tilgjengelige ({blokk.tilgjengelige.length})
      </h3>
      {blokk.tilgjengelige.length === 0 ? (
        <p className={styles.empty}>Ingen tilgjengelige</p>
      ) : (
        <ul className={styles.liste}>
          {blokk.tilgjengelige.map((r) => (
            <li key={r.id} className={styles.listeRad}>
              <span className={styles.navn}>
                {r.navn}
                {r.harDagKommentar ? (
                  <span className={styles.stjerne} title="Merknad i bemanningsplan">
                    {" "}
                    *
                  </span>
                ) : null}
              </span>
              <span className={styles.tid}>{r.arbeidstid ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function InfoskjermPage() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<InfoskjermOversikt | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
  }, []);

  useEffect(() => {
    if (token === null) return;
    if (!token) {
      setFeil("Mangler tilgangstoken i URL");
      return;
    }

    let avbrutt = false;

    async function hent() {
      try {
        const res = await fetch(`/api/skjerm?token=${encodeURIComponent(token!)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Feil ${res.status}`);
        }
        const json = (await res.json()) as InfoskjermOversikt;
        if (!avbrutt) {
          setData(json);
          setFeil(null);
        }
      } catch (e) {
        if (!avbrutt) {
          setFeil(e instanceof Error ? e.message : "Kunne ikke hente data");
        }
      }
    }

    void hent();
    const id = window.setInterval(() => void hent(), OPPDATER_MS);
    return () => {
      avbrutt = true;
      window.clearInterval(id);
    };
  }, [token]);

  if (feil) {
    return (
      <div className={styles.wrap}>
        <p className={styles.feil}>{feil}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.wrap}>
        <p className={styles.laster}>Henter dagens status …</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p className={styles.merk}>KOordinate · Infoskjerm</p>
          <h1 className={styles.tittel}>{data.datoTekst}</h1>
        </div>
        <div className={styles.kpiRad}>
          <div className={`${styles.kpi} ${styles.kpiBad}`}>
            <span className={styles.kpiVerdi}>{data.avvikTotalt}</span>
            <span className={styles.kpiEtikett}>Trenger handling</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiVerdi}>{data.personerUte}</span>
            <span className={styles.kpiEtikett}>Personer ute</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiVerdi}>{data.kjøretøyUte.length}</span>
            <span className={styles.kpiEtikett}>Kjøretøy ute</span>
          </div>
        </div>
      </header>

      <div className={styles.grid}>
        <SkiftPanel blokk={data.dag} />
        <SkiftPanel blokk={data.kveld} />
      </div>

      <section className={styles.kjoretoy}>
        <h2 className={styles.sectionTitle}>Biler og hengere ute</h2>
        {data.kjøretøyUte.length === 0 ? (
          <p className={styles.empty}>Ingen registrert ute i dag</p>
        ) : (
          <ul className={styles.kjoretoyListe}>
            {data.kjøretøyUte.map((k, i) => (
              <li key={`${k.etikett}-${i}`}>
                <strong>{k.etikett}</strong>
                <span className={styles.kjoretoyType}>{k.type}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className={styles.fotnote}>{data.fotnote}</footer>
    </div>
  );
}
