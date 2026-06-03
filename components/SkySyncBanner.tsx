"use client";

import { listDirtyKeys } from "@/lib/data/dirtyKeys";
import { onSkySyncNotice, type SkySyncNotice } from "@/lib/data/skySyncNotify";
import { useAuth } from "@/lib/state/authStore";
import { useAppDataReload } from "@/lib/state/appDataReload";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useEffect, useState } from "react";
import styles from "./SkySaveBanner.module.css";

function kortNøkkel(key: string): string {
  return key.replace(/^bemanning\./, "").replace(/\.v\d+$/, "");
}

function meldingFor(notice: SkySyncNotice): { text: string; kind: "info" | "warn" } {
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
      text: `Sky har nyere data (${navn}), men du har ulagrede endringer lokalt. Lagre eller bruk «Hent fra sky» i Innstillinger.`,
    };
  }
  return {
    kind: "warn",
    text: "Noen andre har lagret nyere data. Hent siste versjon fra sky før du lagrer videre.",
  };
}

export default function SkySyncBanner() {
  const { profile, configured, canEdit } = useAuth();
  const { reloadFromCloud } = useAppDataReload();
  const [notice, setNotice] = useState<SkySyncNotice | null>(null);
  const [henter, setHenter] = useState(false);

  useEffect(() => {
    return onSkySyncNotice((next) => {
      setNotice(next);
      if (next.type === "applied") {
        window.setTimeout(() => {
          setNotice((current) => (current?.at === next.at ? null : current));
        }, 5000);
      }
    });
  }, []);

  if (!configured && !isSupabaseConfigured()) return null;
  if (!profile || !notice) return null;

  const { text, kind } = meldingFor(notice);
  const className = kind === "info" ? styles.ok : styles.error;

  async function handleHentFraSky() {
    const dirty = listDirtyKeys();
    const force = dirty.length > 0;
    if (force) {
      const navn = dirty.map(kortNøkkel).join(", ");
      if (
        !window.confirm(
          `Forkaste ulagrede lokale endringer (${navn}) og hente alt fra sky?\n\nDette kan ikke angres.`,
        )
      ) {
        return;
      }
    }
    setHenter(true);
    try {
      await reloadFromCloud({ force });
      setNotice(null);
    } finally {
      setHenter(false);
    }
  }

  return (
    <div className={className} role="status">
      <span>{text}</span>
      {notice.type !== "applied" && canEdit ? (
        <>
          <button type="button" className={styles.dismiss} onClick={handleHentFraSky} disabled={henter}>
            {henter ? "Henter …" : "Hent fra sky"}
          </button>
          <button type="button" className={styles.dismiss} onClick={() => setNotice(null)}>
            Lukk
          </button>
        </>
      ) : null}
    </div>
  );
}
