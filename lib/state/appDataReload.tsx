"use client";

import {
  syncLocalCacheFromSky,
  type SkySyncOptions,
  type SkySyncResult,
} from "@/lib/data/appDataStorage";
import { clearAllDirtyKeys } from "@/lib/data/dirtyKeys";
import { startSkyLiveSync } from "@/lib/data/skyLiveSync";
import { useAuth } from "@/lib/state/authStore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AppDataReloadValue = {
  lastSync: SkySyncResult | null;
  reloadFromCloud: (options?: SkySyncOptions) => Promise<SkySyncResult>;
};

const Ctx = createContext<AppDataReloadValue | null>(null);

export function AppDataReloadProvider({ children }: { children: React.ReactNode }) {
  const { profile, configured, dataReady } = useAuth();
  const [lastSync, setLastSync] = useState<SkySyncResult | null>(null);

  const reloadFromCloud = useCallback(async (options?: SkySyncOptions) => {
    if (options?.force) {
      clearAllDirtyKeys();
    }
    const result = await syncLocalCacheFromSky(options);
    setLastSync(result);
    return result;
  }, []);

  useEffect(() => {
    if (!configured || !profile || !dataReady) return;
    return startSkyLiveSync();
  }, [configured, profile, dataReady]);

  const value = useMemo(
    () => ({ lastSync, reloadFromCloud }),
    [lastSync, reloadFromCloud],
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
