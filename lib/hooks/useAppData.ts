"use client";

import { loadAppData, saveAppData } from "@/lib/data/appDataStorage";
import { useAuth } from "@/lib/state/authStore";
import { useEffect, useRef, useState } from "react";

type UseAppDataOptions<T> = {
  getDefault: () => T;
  parse: (raw: unknown) => T;
};

export function useAppData<T>(key: string, options: UseAppDataOptions<T>) {
  const { dataReady, canEdit } = useAuth();
  const [data, setData] = useState<T>(options.getDefault);
  const [loaded, setLoaded] = useState(false);
  const hoppOverNesteLagring = useRef(true);

  useEffect(() => {
    if (!dataReady) return;

    let cancelled = false;
    hoppOverNesteLagring.current = true;

    void (async () => {
      try {
        const raw = await loadAppData(key);
        if (cancelled) return;
        setData(options.parse(raw));
      } catch {
        if (!cancelled) setData(options.getDefault());
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, dataReady]);

  useEffect(() => {
    if (!loaded || !dataReady) return;
    if (hoppOverNesteLagring.current) {
      hoppOverNesteLagring.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      void saveAppData(key, data, canEdit);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [key, data, loaded, dataReady, canEdit]);

  return { data, setData, loaded: loaded && dataReady };
}
