"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { canEditData, canEditMasterdata, type UserProfile } from "@/lib/auth/types";
import { hentProfilForBruker } from "@/lib/auth/hentProfil";
import { syncOnLogin, type SkySyncResult } from "@/lib/data/appDataStorage";
import { notifyAppDataKeysUpdated } from "@/lib/data/appDataEngine";
import { APP_DATA_KEYS } from "@/lib/data/storageKeys";
import { isDevEnvironment } from "@/lib/env/isDevEnvironment";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type SkySyncStatus = {
  updated: number;
  missingCount: number;
  error?: string;
  /** Sky har ingen rader — visningsbrukere får da ikke plan/masterplan/fravær. */
  skyTom: boolean;
};

type AuthContextValue = {
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  canEdit: boolean;
  canEditMasterdata: boolean;
  dataReady: boolean;
  skySyncStatus: SkySyncStatus | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function tilSkySyncStatus(result: SkySyncResult): SkySyncStatus {
  return {
    updated: result.updated,
    missingCount: result.missing.length,
    error: result.error,
    skyTom: !result.error && result.updated === 0 && result.missing.length > 0,
  };
}

export function AuthStoreProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(configured);
  const [dataReady, setDataReady] = useState(!configured);
  const [skySyncStatus, setSkySyncStatus] = useState<SkySyncStatus | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const syncedUserIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) {
      setProfile(null);
      setLoading(false);
      return;
    }

    if (profileRef.current === null) {
      setLoading(true);
    }
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        return;
      }

      setProfile(await hentProfilForBruker(supabase, user.id, user.email ?? null));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    void refresh();

    if (!configured) return;

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => subscription.unsubscribe();
  }, [configured, refresh]);

  useEffect(() => {
    if (!configured) {
      setDataReady(true);
      setSkySyncStatus(null);
      syncedUserIdRef.current = null;
      return;
    }
    if (loading) {
      return;
    }
    if (!profile) {
      setDataReady(true);
      setSkySyncStatus(null);
      syncedUserIdRef.current = null;
      return;
    }

    if (syncedUserIdRef.current === profile.id) {
      setDataReady(true);
      return;
    }

    let cancelled = false;
    setDataReady(false);

    const timeoutMs = 45_000;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        console.warn("[auth] syncOnLogin tok uvanlig lang tid — viser app med lokal cache");
        syncedUserIdRef.current = profile.id;
        setDataReady(true);
      }
    }, timeoutMs);

    void syncOnLogin().then((result) => {
      if (!cancelled) setSkySyncStatus(tilSkySyncStatus(result));
    }).finally(() => {
      window.clearTimeout(timeoutId);
      if (!cancelled) {
        syncedUserIdRef.current = profile.id;
        setDataReady(true);
        notifyAppDataKeysUpdated([...APP_DATA_KEYS]);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [configured, loading, profile?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      loading,
      configured,
      dataReady,
      skySyncStatus,
      canEdit:
        configured && profile
          ? canEditData(profile.role)
          : !configured && isDevEnvironment(),
      canEditMasterdata:
        configured && profile
          ? canEditMasterdata(profile.role)
          : !configured && isDevEnvironment(),
      refresh,
    }),
    [profile, loading, configured, dataReady, skySyncStatus, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth må brukes innenfor AuthStoreProvider");
  }
  return ctx;
}
