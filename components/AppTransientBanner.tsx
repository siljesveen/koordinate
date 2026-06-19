"use client";

import { listDirtyKeys } from "@/lib/data/dirtyKeys";
import { onSkySyncNotice, type SkySyncNotice } from "@/lib/data/skySyncNotify";
import { useBekreftDialog } from "@/components/useBekreftDialog";
import { useAuth } from "@/lib/state/authStore";
import { useAppDataReload } from "@/lib/state/appDataReload";
import { useSkySaveStore } from "@/lib/state/skySaveStore";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useEffect, useState } from "react";
import styles from "./AppTransientBanner.module.css";

function kortNøkkel(key: string): string {
  return key.replace(/^bemanning\./, "").replace(/\.v\d+$/, "");
}

function meldingForSync(notice: SkySyncNotice): { text: string; kind: "info" | "warn" } {
  if (notice.type === "applied") {
    const navn = notice.keys.map(kortNøkkel).join(", ");
    return {
      kind: "info",
      text: navn ? `Oppdatert fra sky: ${navn}` : "Oppdatert fra sky",
    };
  }
  if (notice.type === "skipped_dirty") {
    const navn = notice.keys.map(kortNøkkel).join(", ");
    return {
      kind: "warn",
      text: `Sky har nyere data (${navn}), men du har ulagrede endringer lokalt.`,
    };
  }
  return {
    kind: "warn",
    text: "Noen andre har lagret nyere data. Hent siste versjon fra sky før du lagrer videre.",
  };
}

type Melding =
  | { id: string; kind: "error" | "warn" | "ok"; text: string; actions?: "sync" | "dismiss" }
  | null;

/** Én fast høyde — unngår at siden hopper ved lagring/synk-meldinger. */
export default function AppTransientBanner() {
  const { profile, configured, canEdit, skySyncStatus } = useAuth();
  const { requestBekreft, dialog: bekreftDialog } = useBekreftDialog();
  const { lastResult, lastOkAt, dismissError, showError } = useSkySaveStore();
  const { reloadFromCloud } = useAppDataReload();
  const [syncNotice, setSyncNotice] = useState<SkySyncNotice | null>(null);
  const [henter, setHenter] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return onSkySyncNotice((next) => {
      setSyncNotice(next);
      if (next.type === "applied") {
        window.setTimeout(() => {
          setSyncNotice((current) => (current?.at === next.at ? null : current));
        }, 5000);
      }
    });
  }, []);

  useEffect(() => {
    if (!lastOkAt) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [lastOkAt]);

  const supabaseAktiv = configured || isSupabaseConfigured();
  const dev = process.env.NODE_ENV === "development";
  const reserverPlass = supabaseAktiv && (Boolean(profile) || dev);

  if (!reserverPlass) return bekreftDialog;

  let melding: Melding = null;

  if (!profile) {
    melding = null;
  } else {

  if (showError && lastResult?.error) {
    melding = {
      id: "save-error",
      kind: "error",
      text: lastResult.conflict
        ? `Konflikt: noen andre har lagret nyere data. (${lastResult.error})`
        : `Data ble ikke lagret i Supabase. (${lastResult.error})`,
      actions: lastResult.conflict ? "sync" : "dismiss",
    };
  } else if (syncNotice && syncNotice.type !== "applied") {
    const { text, kind } = meldingForSync(syncNotice);
    melding = {
      id: `sync-${syncNotice.at}`,
      kind: kind === "info" ? "ok" : kind,
      text,
      actions: canEdit ? "sync" : "dismiss",
    };
  } else if (skySyncStatus?.error) {
    melding = {
      id: "sky-sync-error",
      kind: "warn",
      text: `Kunne ikke hente data fra sky: ${skySyncStatus.error}. Prøv «Hent fra sky» under Innstillinger.`,
    };
  } else if (skySyncStatus?.skyTom) {
    melding = {
      id: "sky-empty",
      kind: "warn",
      text: canEdit
        ? "Supabase er tom — gå til Innstillinger og overfør data fra nettleseren, så andre brukere kan lese planen."
        : "Ingen data i sky ennå. Be admin/planlegger om å overføre data fra Innstillinger.",
    };
  } else if (!canEdit) {
    melding = {
      id: "readonly",
      kind: "ok",
      text: "Kun visning — du kan se data, men ikke lagre endringer.",
    };
  } else if (lastOkAt && Date.now() - lastOkAt < 4000) {
    melding = { id: "save-ok", kind: "ok", text: "Lagret i Supabase" };
  } else if (syncNotice?.type === "applied") {
    const { text, kind } = meldingForSync(syncNotice);
    melding = { id: `sync-ok-${syncNotice.at}`, kind: kind === "info" ? "ok" : kind, text };
  }
  }

  async function handleHentFraSky() {
    const dirty = listDirtyKeys();
    if (dirty.length > 0) {
      const navn = dirty.map(kortNøkkel).join(", ");
      const ok = await requestBekreft(
        `Forkaste ulagrede lokale endringer (${navn}) og hente alt fra sky?\n\nDette kan ikke angres.`,
        { bekreftTekst: "Hent fra sky" },
      );
      if (!ok) return;
    }
    setHenter(true);
    try {
      await reloadFromCloud({ force: dirty.length > 0 });
      setSyncNotice(null);
      dismissError();
    } finally {
      setHenter(false);
    }
  }

  if (!melding) {
    return (
      <>
        <div className={styles.rail} aria-hidden="true">
          <div className={styles.placeholder} />
        </div>
        {bekreftDialog}
      </>
    );
  }

  const className =
    melding.kind === "error" ? styles.error : melding.kind === "warn" ? styles.warn : styles.ok;

  return (
    <>
      <div className={styles.rail} role="status" aria-live="polite">
        <div className={className}>
          <span className={styles.text}>{melding.text}</span>
          {melding.actions === "sync" && canEdit ? (
            <button
              type="button"
              className={styles.btn}
              onClick={handleHentFraSky}
              disabled={henter}
            >
              {henter ? "Henter …" : "Hent fra sky"}
            </button>
          ) : null}
          {melding.actions === "dismiss" || (melding.actions === "sync" && !canEdit) ? (
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                setSyncNotice(null);
                dismissError();
              }}
            >
              Lukk
            </button>
          ) : null}
          {syncNotice?.type === "applied" ? (
            <button type="button" className={styles.btn} onClick={() => setSyncNotice(null)}>
              Lukk
            </button>
          ) : null}
        </div>
      </div>
      {bekreftDialog}
    </>
  );
}
