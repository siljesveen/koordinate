"use client";

import { useAuth } from "@/lib/state/authStore";
import { useSkySaveStore } from "@/lib/state/skySaveStore";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import styles from "./SkySaveBanner.module.css";

export default function SkySaveBanner() {
  const { profile, configured } = useAuth();
  const { lastResult, lastOkAt, dismissError, showError } = useSkySaveStore();

  if (!configured && !isSupabaseConfigured()) return null;
  if (!profile) return null;

  if (showError && lastResult?.error) {
    return (
      <div className={styles.error} role="alert">
        <strong>
          {lastResult.conflict
            ? "Konflikt: noen andre har lagret nyere data."
            : "Data ble ikke lagret i Supabase."}
        </strong>{" "}
        {lastResult.conflict
          ? "Hent siste versjon fra sky (Innstillinger) før du lagrer videre."
          : "Endringen ligger kun i nettleseren og kan forsvinne."}{" "}
        ({lastResult.error})
        <button type="button" className={styles.dismiss} onClick={dismissError}>
          Lukk
        </button>
      </div>
    );
  }

  if (lastOkAt && Date.now() - lastOkAt < 4000) {
    return (
      <div className={styles.ok} role="status">
        Lagret i Supabase
      </div>
    );
  }

  return null;
}
