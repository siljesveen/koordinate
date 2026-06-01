"use client";

import { pullRemoteChanges } from "@/lib/data/appDataStorage";
import { APP_DATA_KEYS, type AppDataKey } from "@/lib/data/storageKeys";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { setKeyMeta } from "@/lib/data/syncMeta";
import { isKeyDirty } from "@/lib/data/dirtyKeys";
import { reportSkySyncNotice } from "@/lib/data/skySyncNotify";

const POLL_MS = 30_000;

function skrivLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignorer
  }
}

function dispatchDataSynced(): void {
  window.dispatchEvent(new CustomEvent("koordinate:dataSynced"));
}

function applyRemoteRow(key: string, value: unknown, updatedAt: string): boolean {
  if (!(APP_DATA_KEYS as readonly string[]).includes(key)) return false;
  if (isKeyDirty(key as AppDataKey)) return false;
  skrivLocal(key, value);
  setKeyMeta(key, updatedAt);
  return true;
}

/** Periodisk + Realtime henting fra Supabase. */
export function startSkyLiveSync(onTick: () => void): () => void {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return () => {};
  }

  let stopped = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const runPoll = () => {
    if (stopped) return;
    void pullRemoteChanges().then((result) => {
      if (result.updated > 0) onTick();
    });
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
          if (!row?.key || !row.updated_at) return;

          if (isKeyDirty(row.key as AppDataKey)) {
            reportSkySyncNotice({ type: "skipped_dirty", keys: [row.key] });
            return;
          }

          if (applyRemoteRow(row.key, row.value, row.updated_at)) {
            reportSkySyncNotice({ type: "applied", keys: [row.key] });
            onTick();
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
