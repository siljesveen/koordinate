"use client";

import {
  patchAppData,
  readAppDataLocal,
  subscribeAppDataKey,
} from "@/lib/data/appDataEngine";
import type { AppDataKey } from "@/lib/data/storageKeys";
import { canEditAppDataKey } from "@/lib/auth/permissions";
import { useAuth } from "@/lib/state/authStore";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

type UseAppDataOptions<T> = {
  getDefault: () => T;
  parse: (raw: unknown) => T;
};

export function useAppData<T>(key: string, options: UseAppDataOptions<T>) {
  const { dataReady, profile, canEdit } = useAuth();
  const appKey = key as AppDataKey;
  const canEditKey =
    profile != null ? canEditAppDataKey(profile.role, appKey) : canEdit;
  const [data, setData] = useState<T>(options.getDefault);
  const [loaded, setLoaded] = useState(false);
  const parseRef = useRef(options.parse);
  parseRef.current = options.parse;
  const dataRef = useRef(data);
  dataRef.current = data;

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
      if (!canEditKey) return;
      patchAppData<T>(
        appKey,
        () => {
          const prev = dataRef.current;
          const next =
            typeof updater === "function"
              ? (updater as (value: T) => T)(prev)
              : updater;
          return next;
        },
        { canEdit: canEditKey },
      );
    },
    [appKey, canEditKey],
  );

  return { data, setData: setDataGuarded, loaded: loaded && dataReady, canEdit: canEditKey };
}
