"use client";

import { onSkySave, type SkySaveResult } from "@/lib/data/skySaveNotify";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SkySaveStoreValue = {
  lastResult: SkySaveResult | null;
  lastOkAt: number | null;
  dismissError: () => void;
};

const Ctx = createContext<SkySaveStoreValue | null>(null);

export function SkySaveStoreProvider({ children }: { children: ReactNode }) {
  const [lastResult, setLastResult] = useState<SkySaveResult | null>(null);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    return onSkySave((result) => {
      setLastResult(result);
      if (result.savedToSky) {
        setLastOkAt(Date.now());
        setDismissedKey(null);
      }
    });
  }, []);

  const dismissError = () => {
    if (lastResult) setDismissedKey(lastResult.key + (lastResult.error ?? ""));
  };

  const value = useMemo(
    () => ({
      lastResult,
      lastOkAt,
      dismissError,
      showError:
        lastResult &&
        !lastResult.savedToSky &&
        lastResult.error &&
        dismissedKey !== lastResult.key + lastResult.error,
    }),
    [lastResult, lastOkAt, dismissedKey],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSkySaveStore(): SkySaveStoreValue & { showError?: boolean } {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSkySaveStore må brukes innenfor SkySaveStoreProvider");
  return ctx as SkySaveStoreValue & { showError?: boolean };
}
