import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente para el navegador / componentes (solo lectura con anon key).
let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // modo mock: sin credenciales
  if (!browserClient) browserClient = createClient(url, key);
  return browserClient;
}
