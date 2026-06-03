"use client";

import {
  syncLocalCacheFromSky,
  type SkySyncOptions,
  type SkySyncResult,
} from "@/lib/data/appDataStorage";
import { clearAllDirtyKeys } from "@/lib/data/dirtyKeys";
import { startSkyLiveSync } from "@/lib/data/skyLiveSync";
import { useAuth } from "@/lib/state/authStore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AppDataReloadValue = {
  reloadTick: number;
  lastSync: SkySyncResult | null;
  reloadFromCloud: (options?: SkySyncOptions) => Promise<SkySyncResult>;
};

const Ctx = createContext<AppDataReloadValue | null>(null);

export function AppDataReloadProvider({ children }: { children: React.ReactNode }) {
  const { profile, configured, dataReady } = useAuth();
  const [reloadTick, setReloadTick] = useState(0);
  const [lastSync, setLastSync] = useState<SkySyncResult | null>(null);

  const reloadFromCloud = useCallback(async (options?: SkySyncOptions) => {
    if (options?.force) {
      clearAllDirtyKeys();
    }
    const result = await syncLocalCacheFromSky(options);
    setLastSync(result);
    setReloadTick((n) => n + 1);
    return result;
  }, []);

  useEffect(() => {
    function påSynkFerdig() {
      setReloadTick((n) => n + 1);
    }
    window.addEventListener("koordinate:dataSynced", påSynkFerdig);
    return () => window.removeEventListener("koordinate:dataSynced", påSynkFerdig);
  }, []);

  useEffect(() => {
    if (!configured || !profile || !dataReady) return;
    return startSkyLiveSync(() => setReloadTick((n) => n + 1));
  }, [configured, profile, dataReady]);

  const value = useMemo(
    () => ({ reloadTick, lastSync, reloadFromCloud }),
    [reloadTick, lastSync, reloadFromCloud],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppDataReload(): AppDataReloadValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useAppDataReload må brukes innenfor AppDataReloadProvider");
  }
  return ctx;
}
