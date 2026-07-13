import { sb } from "@/lib/supabase";
import { embed } from "@/lib/embeddings";

// Memory Browser: listar e criar memórias. Nada é escondido — tudo legível e editável.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const zone = url.searchParams.get("zone");
  const showArchived = url.searchParams.get("archived") === "true";

  let query = sb()
    .from("memories")
    .select("id, created_at, updated_at, kind, content, zone, confidence, archived")
    .order("created_at", { ascending: false })
    .limit(300);

  if (zone) query = query.eq("zone", zone);
  if (!showArchived) query = query.eq("archived", false);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ memories: data });
}

export async function POST(req: Request) {
  const { kind, content, zone } = await req.json();
  if (!content) return Response.json({ error: "content é obrigatório" }, { status: 400 });

  const [embedding] = await embed([content], "memory_write");
  const { data, error } = await sb()
    .from("memories")
    .insert({
      kind: kind ?? "fact",
      content,
      zone: zone ?? "negocios",
      confidence: 1.0, // escrita manual do Cris = confiança máxima
      embedding,
    })
    .select("id, created_at, kind, content, zone, confidence, archived")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ memory: data });
}
