import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente server-side con service_role (escritura, usado por sync/cron).
let serverClient: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // modo mock
  if (!serverClient) {
    serverClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serverClient;
}

export const isLiveMode = () =>
  process.env.DATA_MODE === "live" && !!getServiceSupabase();
