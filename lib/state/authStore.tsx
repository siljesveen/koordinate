"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { canEditData, type UserProfile } from "@/lib/auth/types";
import { fetchProfileAction } from "@/app/actions/skyData";
import { syncOnLogin } from "@/lib/data/appDataStorage";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type AuthContextValue = {
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  canEdit: boolean;
  dataReady: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthStoreProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(configured);
  const [dataReady, setDataReady] = useState(!configured);

  const refresh = useCallback(async () => {
    if (!configured) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const serverProfile = await fetchProfileAction();
      if (serverProfile) {
        setProfile(serverProfile);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        return;
      }

      setProfile({
        id: user.id,
        email: user.email ?? null,
        display_name: null,
        role: "visning",
      });
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
      return;
    }
    if (loading) {
      setDataReady(false);
      return;
    }
    // Ikke innlogget: vis login uten å vente på data-migrering
    if (!profile) {
      setDataReady(true);
      return;
    }

    let cancelled = false;
    setDataReady(false);

    const timeoutMs = 12_000;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) setDataReady(true);
    }, timeoutMs);

    void syncOnLogin().finally(() => {
      window.clearTimeout(timeoutId);
      if (!cancelled) setDataReady(true);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [configured, loading, profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      loading,
      configured,
      dataReady,
      canEdit: !configured || (profile ? canEditData(profile.role) : false),
      refresh,
    }),
    [profile, loading, configured, dataReady, refresh],
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
