import { sb } from "@/lib/supabase";

// Memória portável (princípio 10): export completo em um clique.
// ?format=json (tudo) | ?format=md (memórias legíveis por zona)

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const stamp = new Date().toISOString().slice(0, 10);

  const [memories, turns, trainingPairs, projects, protocols] = await Promise.all([
    sb().from("memories").select("*").order("created_at"),
    sb().from("turns").select("id, session_id, created_at, role, modality, content, route, zone, place_label, timezone").order("created_at"),
    sb().from("training_pairs").select("id, created_at, prompt, completion, context, quality, tags").order("created_at"),
    sb().from("projects").select("*"),
    sb().from("protocols").select("*"),
  ]);

  if (format === "md") {
    const zones = ["pessoal", "familia", "trabalho", "projetos", "escrita"];
    let md = `# Cérebro — Export de Memória\n\nExportado em ${new Date().toISOString()}\n`;
    for (const zone of zones) {
      const inZone = (memories.data ?? []).filter((m) => m.zone === zone && !m.archived);
      if (inZone.length === 0) continue;
      md += `\n## Zona: ${zone}\n\n`;
      for (const m of inZone) {
        md += `- **[${m.kind}]** ${m.content} _(confiança ${m.confidence}, ${String(m.created_at).slice(0, 10)})_\n`;
      }
    }
    md += `\n---\n\n## Conversas (${(turns.data ?? []).length} turnos)\n\n`;
    for (const t of turns.data ?? []) {
      md += `**${t.role === "cris" ? "Cris" : "Cérebro"}** (${String(t.created_at).slice(0, 16).replace("T", " ")}):\n${t.content}\n\n`;
    }
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="cerebro-export-${stamp}.md"`,
      },
    });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    memories: memories.data ?? [],
    turns: turns.data ?? [],
    training_pairs: trainingPairs.data ?? [],
    projects: projects.data ?? [],
    protocols: protocols.data ?? [],
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="cerebro-export-${stamp}.json"`,
    },
  });
}
