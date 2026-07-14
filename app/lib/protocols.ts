import { sb } from "./supabase";

// M5 — Protocolos (camada Iron Man, diretiva §8): config JSON injetado no system prompt.

export type Protocol = { name: string; config: { prompt?: string }; active: boolean };

export async function getActiveProtocols(): Promise<Protocol[]> {
  const { data } = await sb()
    .from("protocols")
    .select("name, config, active")
    .eq("active", true);
  return (data ?? []) as Protocol[];
}

export async function listProtocols(): Promise<{ name: string; active: boolean }[]> {
  const { data } = await sb().from("protocols").select("name, active").order("name");
  return data ?? [];
}

export async function toggleProtocol(name: string, active: boolean): Promise<string> {
  const { data, error } = await sb()
    .from("protocols")
    .update({ active })
    .ilike("name", name.trim())
    .select("name")
    .maybeSingle();
  if (error) return `falha: ${error.message}`;
  if (!data) {
    const all = await listProtocols();
    return `protocolo "${name}" não existe. Disponíveis: ${all.map((p) => p.name).join(", ")}`;
  }
  return `protocolo ${data.name} ${active ? "ATIVADO" : "desativado"}`;
}
