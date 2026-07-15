import { sb } from "@/lib/supabase";
import { getFocusedProject } from "@/lib/projects";

// Tela de projeto: o em-foco com notas vivas + últimas conversas; senão, a lista.
export async function GET() {
  const project = await getFocusedProject();

  const { data: all } = await sb()
    .from("projects")
    .select("id, name, kind, status, in_focus, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (!project) return Response.json({ project: null, projects: all ?? [] });

  const { data: lastTurns } = await sb()
    .from("turns")
    .select("role, content, created_at")
    .eq("active_project", project.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return Response.json({
    project,
    projects: all ?? [],
    turns: (lastTurns ?? []).reverse(),
  });
}
