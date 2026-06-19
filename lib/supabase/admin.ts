import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./env";

/** Service role-klient — kun server-side (admin-operasjoner). */
export function createAdminClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase er ikke konfigurert");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY mangler på serveren");
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
