"use client";

import { fetchSkyOverviewAction, verifySkySaveAction } from "@/app/actions/skyData";
import {
  uploadLocalStorageToSky,
  type UploadToSkyResult,
} from "@/lib/data/appDataStorage";
import { clearAllDirtyKeys } from "@/lib/data/dirtyKeys";
import { forklaringBlokkering } from "@/lib/data/skyUploadGuard";
import { isDevEnvironment } from "@/lib/env/isDevEnvironment";
import { APP_DATA_KEYS } from "@/lib/data/storageKeys";
import { useAuth } from "@/lib/state/authStore";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const STORAGE_KEYS = APP_DATA_KEYS;

type ExportData = Record<string, unknown>;

function eksporterData(): ExportData {
  const data: ExportData = {};
  for (const key of STORAGE_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  }
  return data;
}

function lastNed(data: ExportData) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dato = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `koordinate-backup-${dato}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function tellPoster(data: ExportData): { nøkler: number; poster: number } {
  let poster = 0;
  for (const val of Object.values(data)) {
    if (Array.isArray(val)) poster += val.length;
    else if (val && typeof val === "object") poster += 1;
  }
  return { nøkler: Object.keys(data).length, poster };
}

function formatUploadMelding(result: UploadToSkyResult, prefiks: string): string {
  if (result.error && result.imported === 0) {
    return `${prefiks} ${result.error}`;
  }
  let melding = `${prefiks} ${result.imported} datasett i Supabase.`;
  if (result.blocked.length > 0) {
    const hoppet = result.blocked
      .map((b) => `${b.key.replace("bemanning.", "")} (${forklaringBlokkering(b.reason)})`)
      .join(", ");
    melding += ` Hoppet over (for å beskytte eksisterende data): ${hoppet}.`;
  }
  if (result.skipped.length > 0) {
    melding += ` Server hoppet over: ${result.skipped.map((k) => k.replace("bemanning.", "")).join(", ")}.`;
  }
  return melding;
}

export default function InnstillingerPage() {
  const { profile, canEdit, configured } = useAuth();
  const supabaseAktiv = configured || isSupabaseConfigured();
  const visAvansert = isDevEnvironment();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [skyOverview, setSkyOverview] = useState<string | null>(null);
  const [skyAntallNøkler, setSkyAntallNøkler] = useState<number | null>(null);
  const [lasterSky, setLasterSky] = useState(false);
  const [lasterOpp, setLasterOpp] = useState(false);
  const [testerLagring, setTesterLagring] = useState(false);
  const [importerer, setImporterer] = useState(false);

  const skyTom = !lasterSky && skyAntallNøkler === 0;
  const skyHarData = !lasterSky && skyAntallNøkler !== null && skyAntallNøkler > 0;

  async function oppdaterSkyOversikt() {
    const result = await fetchSkyOverviewAction();
    if (result.error) {
      setSkyOverview(`Feil: ${result.error}`);
      setSkyAntallNøkler(null);
      return;
    }
    setSkyAntallNøkler(result.rows.length);
    if (result.rows.length === 0) {
      setSkyOverview("Supabase er tom — data i denne nettleseren er ikke i sky ennå.");
      return;
    }
    setSkyOverview(
      result.rows.map((r) => `${r.key.replace("bemanning.", "")}: ${r.summary}`).join(" · "),
    );
  }

  useEffect(() => {
    if (!supabaseAktiv || !profile) {
      setSkyOverview(null);
      setSkyAntallNøkler(null);
      return;
    }
    setLasterSky(true);
    void oppdaterSkyOversikt().finally(() => setLasterSky(false));
  }, [supabaseAktiv, profile]);

  function handleEksport() {
    const data = eksporterData();
    const { nøkler, poster } = tellPoster(data);
    lastNed(data);
    setStatus(`Eksportert ${nøkler} nøkler med ${poster} poster. Ta vare på filen!`);
  }

  async function handleTestLagring() {
    setTesterLagring(true);
    setStatus(null);
    try {
      const result = await verifySkySaveAction();
      if (result.ok) {
        setStatus("Sky-lagring fungerer: testdata ble skrevet og lest tilbake fra Supabase.");
      } else {
        setStatus(`Sky-lagring feilet: ${result.error}`);
      }
    } finally {
      setTesterLagring(false);
    }
  }

  async function handleLagreTilSky() {
    if (
      !window.confirm(
        "Overføre data fra denne nettleseren til Supabase?\n\nNøkler der sky allerede har nyere eller mer komplett data hoppes over automatisk.",
      )
    ) {
      return;
    }
    setLasterOpp(true);
    setStatus(null);
    try {
      clearAllDirtyKeys();
      const result = await uploadLocalStorageToSky();
      setStatus(formatUploadMelding(result, "Overført"));
      await oppdaterSkyOversikt();
    } finally {
      setLasterOpp(false);
    }
  }

  function handleFilValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setStatus("Filen inneholder ikke gyldig backup-data.");
          setImportData(null);
          return;
        }
        const gyldige = Object.keys(parsed).filter((k) =>
          (STORAGE_KEYS as readonly string[]).includes(k),
        );
        if (gyldige.length === 0) {
          setStatus("Filen inneholder ingen kjente KOordinate-nøkler.");
          setImportData(null);
          return;
        }
        setImportData(parsed as ExportData);
        const { nøkler, poster } = tellPoster(parsed);
        setStatus(
          `Klar til import: ${nøkler} nøkler, ${poster} poster. Etter bekreftelse importeres filen${
            supabaseAktiv && canEdit ? " og trygg del lastes opp til sky" : ""
          }.`,
        );
      } catch {
        setStatus("Kunne ikke lese filen. Er det en gyldig JSON-fil?");
        setImportData(null);
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function bekreftImport() {
    if (!importData || !canEdit) return;
    if (
      !window.confirm(
        "Importere backup? Lokale nøkler i filen erstattes. Eksisterende sky-data overskrives bare der det er trygt.",
      )
    ) {
      return;
    }

    setImporterer(true);
    setStatus(null);
    try {
      let importert = 0;
      for (const key of STORAGE_KEYS) {
        if (key in importData) {
          window.localStorage.setItem(key, JSON.stringify(importData[key]));
          importert++;
        }
      }
      setImportData(null);
      clearAllDirtyKeys();

      if (supabaseAktiv && profile) {
        setStatus(`Importert ${importert} nøkler. Laster trygt opp til sky …`);
        const result = await uploadLocalStorageToSky();
        setStatus(formatUploadMelding(result, "Import ferdig:"));
        await oppdaterSkyOversikt();
      } else {
        setStatus(`Importert ${importert} nøkler lokalt.`);
      }

      window.setTimeout(() => window.location.reload(), 1200);
    } finally {
      setImporterer(false);
    }
  }

  function handleLastInnPåNytt() {
    window.location.reload();
  }

  const nåværende = typeof window !== "undefined" ? eksporterData() : {};
  const { nøkler, poster } = tellPoster(nåværende);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Innstillinger</h1>

      {supabaseAktiv && profile ? (
        skyTom ? (
          <section className={styles.alertBox}>
            <h2 className={styles.alertTitle}>Sky er tom</h2>
            <p className={styles.info}>
              Du er innlogget, men Supabase har ingen data ennå. Endringer i appen lagres
              automatisk til sky når du jobber — eller overfør alt fra denne nettleseren én gang
              nå.
            </p>
            <p className={styles.stats}>
              {lasterSky ? "Sjekker Supabase …" : skyOverview ?? "—"}
            </p>
            {canEdit ? (
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={lasterOpp}
                  onClick={handleLagreTilSky}
                >
                  {lasterOpp ? "Overfører …" : "Overfør nettleser-data til sky"}
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={handleEksport}>
                  Last ned backup
                </button>
              </div>
            ) : (
              <p className={styles.info}>Du har kun lesetilgang — kontakt admin for overføring.</p>
            )}
          </section>
        ) : (
          <section className={skyHarData ? styles.okBox : styles.section}>
            <h2 className={skyHarData ? styles.okTitle : styles.sectionTitle}>Lagring i sky</h2>
            <p className={styles.info}>
              {canEdit
                ? "Endringer lagres automatisk i Supabase når du redigerer i appen. Du trenger normalt ikke å lagre manuelt."
                : "Du har lesetilgang. Data hentes fra Supabase."}
            </p>
            <p className={styles.stats}>
              {lasterSky ? "Sjekker Supabase …" : skyOverview ?? "—"}
            </p>
            <div className={styles.buttonRow}>
              <button type="button" className={styles.primaryBtn} onClick={handleEksport}>
                Last ned backup (sikkerhetskopi)
              </button>
            </div>
            {canEdit ? (
              <details className={styles.advanced}>
                <summary>Avansert</summary>
                <div className={styles.advancedBody}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={lasterOpp}
                    onClick={handleLagreTilSky}
                  >
                    {lasterOpp ? "Overfører …" : "Overfør alt fra nettleser til sky"}
                  </button>
                  {visAvansert ? (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={testerLagring}
                      onClick={handleTestLagring}
                    >
                      {testerLagring ? "Tester …" : "Test sky-lagring"}
                    </button>
                  ) : null}
                </div>
              </details>
            ) : null}
          </section>
        )
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Datagrunnlag i nettleseren</h2>
        <p className={styles.info}>
          {supabaseAktiv && profile
            ? "Nettleseren har en lokal kopi for hurtig visning. Supabase er master når du er innlogget."
            : "All data lagres lokalt i nettleseren (localStorage)."}
        </p>
        <p className={styles.stats}>
          {nøkler} aktive nøkler · {poster} poster totalt
        </p>
      </section>

      {!supabaseAktiv || !profile ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Eksporter</h2>
          <p className={styles.info}>Laster ned all data som én JSON-fil.</p>
          <button type="button" className={styles.primaryBtn} onClick={handleEksport}>
            Last ned backup
          </button>
        </section>
      ) : null}

      {canEdit ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Gjenopprett fra backup-fil</h2>
          <p className={styles.info}>
            Kun ved behov (feil, ny maskin). Filen importeres og lastes deretter trygt opp til sky
            der det ikke ville overskrive nyere data.
          </p>
          <label className={styles.fileLabel}>
            Velg fil
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className={styles.fileInput}
              onChange={handleFilValgt}
              disabled={importerer}
            />
          </label>

          {importData ? (
            <div className={styles.confirmRow}>
              <button
                type="button"
                className={styles.dangerBtn}
                disabled={importerer}
                onClick={() => void bekreftImport()}
              >
                {importerer ? "Importerer …" : "Bekreft import"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={importerer}
                onClick={() => {
                  setImportData(null);
                  setStatus(null);
                }}
              >
                Avbryt
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {status ? (
        <div className={styles.statusBox}>
          <p>{status}</p>
          {status.includes("Last inn siden") ? (
            <button type="button" className={styles.primaryBtn} onClick={handleLastInnPåNytt}>
              Last inn siden på nytt
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
