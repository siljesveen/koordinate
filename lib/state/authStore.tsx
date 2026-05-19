"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { canEditData, type AppRole, type UserProfile } from "@/lib/auth/types";
import { migrateLocalStorageToSupabase } from "@/lib/data/appDataStorage";
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

function mapProfile(row: {
  id: string;
  email: string | null;
  display_name: string | null;
  role: AppRole;
}): UserProfile {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
  };
}

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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (error || !data) {
        setProfile({
          id: user.id,
          email: user.email ?? null,
          display_name: null,
          role: "visning",
        });
        return;
      }

      setProfile(mapProfile(data as Parameters<typeof mapProfile>[0]));
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
    if (loading || !profile) {
      setDataReady(false);
      return;
    }

    let cancelled = false;
    void migrateLocalStorageToSupabase(profile.id).finally(() => {
      if (!cancelled) setDataReady(true);
    });

    return () => {
      cancelled = true;
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
