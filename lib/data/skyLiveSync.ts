"use client";

import { pullRemoteChanges } from "@/lib/data/appDataStorage";
import { applyRemoteAppDataKey } from "@/lib/data/appDataEngine";
import type { AppDataKey } from "@/lib/data/storageKeys";
import { APP_DATA_KEYS } from "@/lib/data/storageKeys";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isKeyDirty } from "@/lib/data/dirtyKeys";
import { reportSkySyncNotice } from "@/lib/data/skySyncNotify";

const POLL_MS = 30_000;

function erAppDataKey(key: string): key is AppDataKey {
  return (APP_DATA_KEYS as readonly string[]).includes(key);
}

/** Periodisk + Realtime henting fra Supabase. Oppdaterer kun berørte nøkler via appDataEngine. */
export function startSkyLiveSync(): () => void {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return () => {};
  }

  let stopped = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const runPoll = () => {
    if (stopped) return;
    void pullRemoteChanges();
  };

  const onFocus = () => runPoll();
  window.addEventListener("focus", onFocus);
  pollTimer = setInterval(runPoll, POLL_MS);

  let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

  try {
    const supabase = createClient();
    channel = supabase
      .channel("koordinate-app-data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_data" },
        (payload) => {
          if (stopped) return;
          const row = payload.new as { key?: string; value?: unknown; updated_at?: string };
          if (!row?.key || !row.updated_at || !erAppDataKey(row.key)) return;

          if (isKeyDirty(row.key)) {
            reportSkySyncNotice({ type: "skipped_dirty", keys: [row.key] });
            return;
          }

          if (applyRemoteAppDataKey(row.key, row.value, row.updated_at)) {
            reportSkySyncNotice({ type: "applied", keys: [row.key] });
          }
        },
      )
      .subscribe();
  } catch (err) {
    console.warn("[skyLiveSync] Realtime ikke tilgjengelig, bruker kun polling:", err);
  }

  return () => {
    stopped = true;
    window.removeEventListener("focus", onFocus);
    if (pollTimer) clearInterval(pollTimer);
    if (channel) {
      try {
        const supabase = createClient();
        void supabase.removeChannel(channel);
      } catch {
        // ignorer
      }
    }
  };
}
