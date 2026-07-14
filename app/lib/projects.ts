import { sb } from "./supabase";

// M6 — Project Mode: um projeto em foco por vez; o cérebro vira parceiro dele.

export type Project = {
  id: string;
  name: string;
  kind: string | null;
  status: string;
  notes: string | null;
};

export async function getFocusedProject(): Promise<Project | null> {
  const { data } = await sb()
    .from("projects")
    .select("id, name, kind, status, notes")
    .eq("in_focus", true)
    .limit(1)
    .maybeSingle();
  return (data as Project) ?? null;
}

export async function openProject(name: string, kind?: string): Promise<string> {
  const clean = name.trim();
  if (!clean) return "nome do projeto vazio";

  // tira o foco de qualquer outro
  await sb().from("projects").update({ in_focus: false }).eq("in_focus", true);

  // acha existente (case-insensitive) ou cria
  const { data: existing } = await sb()
    .from("projects")
    .select("id, name")
    .ilike("name", clean)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await sb()
      .from("projects")
      .update({ in_focus: true, status: "active", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return `projeto "${existing.name}" aberto — modo projeto ativo`;
  }

  const { data: created, error } = await sb()
    .from("projects")
    .insert({ name: clean, kind: kind ?? null, in_focus: true })
    .select("name")
    .single();
  if (error) return `falha ao criar projeto: ${error.message}`;
  return `projeto "${created.name}" criado e aberto — modo projeto ativo`;
}

export async function closeProject(): Promise<string> {
  const current = await getFocusedProject();
  if (!current) return "nenhum projeto estava aberto";
  await sb()
    .from("projects")
    .update({ in_focus: false, updated_at: new Date().toISOString() })
    .eq("id", current.id);
  return `projeto "${current.name}" fechado`;
}

export async function updateProjectNotes(notes: string): Promise<string> {
  const current = await getFocusedProject();
  if (!current) return "nenhum projeto aberto para anotar";
  await sb()
    .from("projects")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", current.id);
  return `notas do projeto "${current.name}" atualizadas`;
}

// "onde a gente parou?" — resumo do estado do projeto
export async function projectStatus(name?: string): Promise<string> {
  let project: Project | null = null;
  if (name?.trim()) {
    const { data } = await sb()
      .from("projects")
      .select("id, name, kind, status, notes")
      .ilike("name", name.trim())
      .limit(1)
      .maybeSingle();
    project = (data as Project) ?? null;
  } else {
    project = await getFocusedProject();
  }
  if (!project) {
    const { data: all } = await sb()
      .from("projects")
      .select("name, status, in_focus")
      .order("updated_at", { ascending: false })
      .limit(10);
    const list = (all ?? [])
      .map((p) => `- ${p.name}${p.in_focus ? " (em foco)" : ""} [${p.status}]`)
      .join("\n");
    return list ? `projeto não encontrado. Projetos existentes:\n${list}` : "nenhum projeto criado ainda";
  }

  const { data: lastTurns } = await sb()
    .from("turns")
    .select("role, content, created_at")
    .eq("active_project", project.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const recent = (lastTurns ?? [])
    .reverse()
    .map(
      (t) =>
        `[${String(t.created_at).slice(0, 10)}] ${t.role === "cris" ? "Cris" : "Cérebro"}: ${t.content.slice(0, 200)}`
    )
    .join("\n");

  return (
    `PROJETO: ${project.name}${project.kind ? ` (${project.kind})` : ""} — status ${project.status}\n` +
    `NOTAS: ${project.notes ?? "(sem notas ainda)"}\n` +
    `ÚLTIMAS CONVERSAS DO PROJETO:\n${recent || "(nenhum turno linkado ainda)"}`
  );
}
