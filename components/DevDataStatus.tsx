"use client";

import {
  fetchSkyOverviewAction,
  importAppDataBatchAction,
  testSkyTilkoblingAction,
} from "@/app/actions/skyData";
import { listDirtyKeys } from "@/lib/data/dirtyKeys";
import { useAuth } from "@/lib/state/authStore";
import { useAppDataReload } from "@/lib/state/appDataReload";
import { useCallback, useEffect, useState } from "react";
import styles from "./DevDataStatus.module.css";

type SkyStatus = "idle" | "sjekker" | "ok" | "feil";

const VERCEL_EKSPORT_SCRIPT = `copy(JSON.stringify(Object.fromEntries(
  ${JSON.stringify([
    "bemanning.ansatte.v2",
    "bemanning.biler.v1",
    "bemanning.henger.v1",
    "bemanning.masterplan.v1",
    "bemanning.fravaer.v1",
    "bemanning.planRuteTildeling.v2",
    "bemanning.dagendring.v1",
    "bemanning.bilUtilgjengelig.v1",
    "bemanning.hengerUtilgjengelig.v1",
  ])}.map(k => [k, JSON.parse(localStorage.getItem(k) || "null")]).filter(([,v]) => v !== null)
)))`;

export default function DevDataStatus() {
  if (process.env.NODE_ENV !== "development") return null;

  const { configured, profile, loading, dataReady } = useAuth();
  const { reloadFromCloud, lastSync } = useAppDataReload();
  const [skyStatus, setSkyStatus] = useState<SkyStatus>("idle");
  const [skyFeil, setSkyFeil] = useState<string | null>(null);
  const [henter, setHenter] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [skyOverview, setSkyOverview] = useState<{ key: string; summary: string }[]>([]);
  const [visDetaljer, setVisDetaljer] = useState(false);
  const [visImport, setVisImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importerer, setImporterer] = useState(false);

  const lastOppSky = useCallback(async () => {
    if (!configured || !profile) {
      setSkyOverview([]);
      return;
    }
    const result = await fetchSkyOverviewAction();
    if (!result.error) {
      setSkyOverview(result.rows);
    }
  }, [configured, profile]);

  const testSky = useCallback(async () => {
    if (!configured || !profile) {
      setSkyStatus("idle");
      setSkyFeil(null);
      return;
    }

    setSkyStatus("sjekker");
    setSkyFeil(null);

    try {
      const result = await testSkyTilkoblingAction();
      if (!result.ok) {
        setSkyStatus("feil");
        setSkyFeil(result.error ?? "Ukjent feil");
        return;
      }
      setSkyStatus("ok");
      await lastOppSky();
    } catch (err) {
      setSkyStatus("feil");
      setSkyFeil(err instanceof Error ? err.message : "Ukjent feil");
    }
  }, [configured, profile, lastOppSky]);

  useEffect(() => {
    void testSky();
  }, [testSky]);

  useEffect(() => {
    if (!profile || skyStatus !== "ok") return;
    const timer = window.setTimeout(() => void lastOppSky(), 400);
    return () => window.clearTimeout(timer);
  }, [profile, skyStatus, lastSync, lastOppSky]);

  const skyOk = configured && !!profile;
  const kanHente = skyOk && dataReady && !loading && skyStatus !== "sjekker";

  const handleHent = async () => {
    const dirty = listDirtyKeys();
    let force = false;
    if (dirty.length > 0) {
      if (
        !window.confirm(
          `Ulagrede lokale endringer (${dirty.join(", ")}). Forkaste og hente alt fra sky?`,
        )
      ) {
        return;
      }
      force = true;
    }
    setHenter(true);
    setSyncMsg(null);
    try {
      const result = await reloadFromCloud({ force });
      if (result.error) {
        setSyncMsg(`Feil ved henting: ${result.error}`);
      } else if (result.updated === 0 && (result.skippedDirty?.length ?? 0) === 0) {
        setSyncMsg(
          "Sky er tom. Data på Vercel ligger sannsynligvis kun i nettleseren der — bruk «Importer fra Vercel» under.",
        );
      } else {
        const ansatte =
          result.ansatteCount != null ? `, ${result.ansatteCount} ansatte` : "";
        const hoppet =
          result.skippedDirty && result.skippedDirty.length > 0
            ? ` (beholdt lokalt: ${result.skippedDirty.map((k) => k.replace("bemanning.", "")).join(", ")})`
            : "";
        setSyncMsg(`Hentet ${result.updated} datasett fra sky${ansatte}${hoppet}.`);
      }
      await lastOppSky();
    } finally {
      setHenter(false);
    }
  };

  const handleImport = async () => {
    setImporterer(true);
    setSyncMsg(null);
    try {
      const payload = JSON.parse(importJson) as Record<string, unknown>;
      const result = await importAppDataBatchAction(payload);
      if (result.error) {
        setSyncMsg(`Import feilet: ${result.error}`);
        return;
      }
      setSyncMsg(`Importerte ${result.imported} datasett til Supabase. Klikk «Hent data fra sky».`);
      setImportJson("");
      await reloadFromCloud();
      await lastOppSky();
    } catch {
      setSyncMsg("Ugyldig JSON. Kopier output fra Vercel-konsollen.");
    } finally {
      setImporterer(false);
    }
  };

  const ansatteISky = skyOverview.find((r) => r.key === "bemanning.ansatte.v2")?.summary;

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.bar}>
        <span className={styles.label}>Dev</span>
        <span className={configured ? styles.ok : styles.err}>
          Supabase: {configured ? "ok" : "mangler"}
        </span>
        <span className={profile ? styles.ok : configured ? styles.warn : styles.err}>
          Bruker: {loading ? "…" : profile ? profile.email ?? "ok" : "—"}
        </span>
        {profile ? (
          <span
            className={
              skyStatus === "ok" ? styles.ok : skyStatus === "feil" ? styles.err : styles.warn
            }
          >
            Sky:{" "}
            {skyStatus === "sjekker"
              ? "sjekker …"
              : skyStatus === "ok"
                ? ansatteISky
                  ? ansatteISky
                  : skyOverview.length > 0
                    ? `${skyOverview.length} nøkler`
                    : "tom"
                : skyStatus === "feil"
                  ? "feil"
                  : "…"}
          </span>
        ) : null}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            disabled={!kanHente}
            onClick={handleHent}
            title="Last inn data på nytt fra Supabase"
          >
            {henter ? "Henter …" : "Hent fra sky"}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => {
              setVisDetaljer((v) => !v);
              if (visDetaljer) setVisImport(false);
            }}
          >
            {visDetaljer ? "Skjul detaljer" : "Detaljer"}
          </button>
        </div>
      </div>

      {visDetaljer ? (
        <div className={styles.details}>
          {!configured ? (
            <p className={styles.hint}>
              Opprett <code>.env.local</code> med Supabase-nøkler, start <code>npm run dev</code> på
              nytt, og logg inn med samme bruker som på Vercel.
            </p>
          ) : !profile ? (
            <p className={styles.hint}>
              Logg inn på localhost for å lese samme Supabase-data som produksjon.
            </p>
          ) : skyStatus === "feil" ? (
            <p className={styles.hint}>
              Klarte ikke lese Supabase ({skyFeil}). Kjør <code>003_grants.sql</code> i Supabase SQL
              Editor.
            </p>
          ) : null}
          {syncMsg ? <p className={styles.hint}>{syncMsg}</p> : null}
          {profile && skyOverview.length > 0 ? (
            <p className={styles.hint}>
              I Supabase:{" "}
              {skyOverview.map((r) => `${r.key.replace("bemanning.", "")} (${r.summary})`).join(", ")}
            </p>
          ) : null}
          {profile && skyStatus === "ok" ? (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setVisImport((v) => !v)}
            >
              {visImport ? "Skjul Vercel-import" : "Importer fra Vercel"}
            </button>
          ) : null}
          {visImport && profile ? (
            <div className={styles.importBox}>
              <p className={styles.hint}>
                <strong>Synk Vercel → Supabase (engangs):</strong> F12 → Console på Vercel, kjør
                scriptet, lim JSON under.
              </p>
              <pre className={styles.script}>{VERCEL_EKSPORT_SCRIPT}</pre>
              <textarea
                className={styles.textarea}
                rows={4}
                placeholder="Lim inn JSON fra Vercel-konsollen …"
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
              />
              <button
                type="button"
                className={styles.btn}
                disabled={!importJson.trim() || importerer}
                onClick={handleImport}
              >
                {importerer ? "Importerer …" : "Last opp til Supabase"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
