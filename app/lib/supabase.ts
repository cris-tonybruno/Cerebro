import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente com service role — SÓ pode ser importado em código de servidor.
// RLS está ligado sem policies: anon não acessa nada; só o servidor passa.
let client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!,
      { auth: { persistSession: false } }
    );
  }
  return client;
}
