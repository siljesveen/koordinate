"use client";

import {
  patchAppData,
  readAppDataLocal,
  subscribeAppDataKey,
} from "@/lib/data/appDataEngine";
import type { AppDataKey } from "@/lib/data/storageKeys";
import { useAuth } from "@/lib/state/authStore";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

type UseAppDataOptions<T> = {
  getDefault: () => T;
  parse: (raw: unknown) => T;
};

export function useAppData<T>(key: string, options: UseAppDataOptions<T>) {
  const { dataReady, canEdit } = useAuth();
  const appKey = key as AppDataKey;
  const [data, setData] = useState<T>(options.getDefault);
  const [loaded, setLoaded] = useState(false);
  const parseRef = useRef(options.parse);
  parseRef.current = options.parse;

  const syncFraCache = useCallback(() => {
    const raw = readAppDataLocal(appKey);
    setData(parseRef.current(raw ?? null));
    setLoaded(true);
  }, [appKey]);

  useEffect(() => {
    if (!dataReady) return;
    syncFraCache();
    return subscribeAppDataKey(appKey, syncFraCache);
  }, [appKey, dataReady, syncFraCache]);

  const setDataGuarded = useCallback<Dispatch<SetStateAction<T>>>(
    (updater) => {
      if (!canEdit) return;
      patchAppData<T>(
        appKey,
        (previous) => {
          const prev = parseRef.current(previous ?? null);
          return typeof updater === "function"
            ? (updater as (value: T) => T)(prev)
            : updater;
        },
        { canEdit },
      );
    },
    [appKey, canEdit],
  );

  return { data, setData: setDataGuarded, loaded: loaded && dataReady, canEdit };
}
