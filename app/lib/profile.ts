import { sb } from "./supabase";

// O EU VIRTUAL — perfil curado do Cris. Entra em TODA deliberação do conselho:
// os fatos vêm do projeto; os valores e o critério de decisão vêm daqui.

export async function getProfile(): Promise<{ content: string; version: number } | null> {
  const { data } = await sb()
    .from("creator_profile")
    .select("content, version, updated_at")
    .eq("id", 1)
    .maybeSingle();
  return data ?? null;
}

export async function updateProfile(content: string): Promise<string> {
  const clean = content.trim();
  if (clean.length < 100) return "perfil muito curto — mande o documento completo (o novo substitui o antigo por inteiro)";
  const current = await getProfile();
  const { data, error } = await sb()
    .from("creator_profile")
    .upsert({
      id: 1,
      content: clean,
      version: (current?.version ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .select("version")
    .single();
  if (error) return `falha ao atualizar perfil: ${error.message}`;
  return `Eu Virtual atualizado — versão ${data.version}`;
}
