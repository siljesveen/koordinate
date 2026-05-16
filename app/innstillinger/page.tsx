"use client";

import { clearAllAnsatteData } from "@/lib/maintenance/clearAllAnsatte";
import { gjenopprettStandardKjoretoy } from "@/lib/maintenance/seedKjoretoy";
import {
  IMPORTERTE_BILER_REFERANSE_2026,
  IMPORTERTE_HENGERE_REFERANSE_2026,
} from "@/lib/imported/kjoretoy-referanse-2026";
import { useRef, useState } from "react";
import styles from "./page.module.css";

const STORAGE_KEYS = [
  "bemanning.ansatte.v2",
  "bemanning.masterplan.v1",
  "bemanning.planRuteTildeling.v2",
  "bemanning.dagendring.v1",
  "bemanning.fravaer.v1",
  "bemanning.biler.v1",
  "bemanning.henger.v1",
  "bemanning.bilUtilgjengelig.v1",
  "bemanning.hengerUtilgjengelig.v1",
  "bemanning.turnus4uker.v1",
] as const;

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

export default function InnstillingerPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [importData, setImportData] = useState<ExportData | null>(null);

  function handleEksport() {
    const data = eksporterData();
    const { nøkler, poster } = tellPoster(data);
    lastNed(data);
    setStatus(`Eksportert ${nøkler} nøkler med ${poster} poster.`);
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
        setStatus(`Klar til import: ${nøkler} nøkler, ${poster} poster. Bekreft nedenfor.`);
      } catch {
        setStatus("Kunne ikke lese filen. Er det en gyldig JSON-fil?");
        setImportData(null);
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function bekreftImport() {
    if (!importData) return;
    if (!window.confirm("Importere data? Eksisterende data overskrives for nøklene som finnes i filen.")) return;

    let importert = 0;
    for (const key of STORAGE_KEYS) {
      if (key in importData) {
        window.localStorage.setItem(key, JSON.stringify(importData[key]));
        importert++;
      }
    }
    setImportData(null);
    setStatus(`Importert ${importert} nøkler. Last inn siden på nytt for å se endringene.`);
  }

  function handleLastInnPåNytt() {
    window.location.reload();
  }

  function handleGjenopprettKjoretoy() {
    if (
      !window.confirm(
        `Gjenopprette standardlisten? Dette legger inn ${IMPORTERTE_BILER_REFERANSE_2026.length} biler og ${IMPORTERTE_HENGERE_REFERANSE_2026.length} hengere (kun reg.nr). Eksisterende biler/hengere i listen erstattes.`,
      )
    ) {
      return;
    }
    gjenopprettStandardKjoretoy();
    setStatus("Biler og hengere er gjenopprettet. Laster inn siden på nytt …");
    window.setTimeout(() => window.location.reload(), 400);
  }

  function handleSlettAlleAnsatte() {
    if (
      !window.confirm(
        "Slette alle ansatte? Fravær og turnus fjernes også. Sjåfør-referanser i masterplan og plan tømmes. Biler og hengere beholdes.",
      )
    ) {
      return;
    }
    clearAllAnsatteData();
    setStatus("Alle ansatte er slettet. Laster inn siden på nytt …");
    window.setTimeout(() => window.location.reload(), 400);
  }

  const nåværende = typeof window !== "undefined" ? eksporterData() : {};
  const { nøkler, poster } = tellPoster(nåværende);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Innstillinger</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Datagrunnlag</h2>
        <p className={styles.info}>
          All data lagres lokalt i nettleseren (localStorage).
          Bruk eksport for å ta backup, og import for å gjenopprette.
        </p>
        <p className={styles.stats}>
          {nøkler} aktive nøkler · {poster} poster totalt
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Eksporter</h2>
        <p className={styles.info}>
          Laster ned all data som én JSON-fil.
        </p>
        <button type="button" className={styles.primaryBtn} onClick={handleEksport}>
          Last ned backup
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Biler og hengere</h2>
        <p className={styles.info}>
          Hvis bil- eller hengerlisten er tom, kan du hente inn standardlisten fra importen
          ({IMPORTERTE_BILER_REFERANSE_2026.length} biler, {IMPORTERTE_HENGERE_REFERANSE_2026.length}{" "}
          hengere).
        </p>
        <button type="button" className={styles.primaryBtn} onClick={handleGjenopprettKjoretoy}>
          Gjenopprett biler og hengere
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Ansatte</h2>
        <p className={styles.info}>
          Tømmer alle ansatte før du legger inn nye fra dokument. Fravær og turnus slettes.
          Fast sjåfør i masterplan og plan fjernes, men biler og hengere beholdes.
        </p>
        <button type="button" className={styles.dangerBtn} onClick={handleSlettAlleAnsatte}>
          Slett alle ansatte
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Importer</h2>
        <p className={styles.info}>
          Last opp en tidligere eksportert backup-fil. Data for nøklene i filen overskrives.
        </p>
        <label className={styles.fileLabel}>
          Velg fil
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className={styles.fileInput}
            onChange={handleFilValgt}
          />
        </label>

        {importData && (
          <div className={styles.confirmRow}>
            <button type="button" className={styles.dangerBtn} onClick={bekreftImport}>
              Bekreft import
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={() => { setImportData(null); setStatus(null); }}>
              Avbryt
            </button>
          </div>
        )}
      </section>

      {status && (
        <div className={styles.statusBox}>
          <p>{status}</p>
          {status.includes("Last inn siden") && (
            <button type="button" className={styles.primaryBtn} onClick={handleLastInnPåNytt}>
              Last inn siden på nytt
            </button>
          )}
        </div>
      )}
    </div>
  );
}
