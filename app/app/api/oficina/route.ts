import { sb } from "@/lib/supabase";
import { auditEvent } from "@/lib/security";

// A esteira da oficina: chamados do Vigia com estado + decisão do Cris (aprova/rejeita).

export async function GET() {
  const { data, error } = await sb()
    .from("dev_backlog")
    .select("id, created_at, request, status, pipeline, job_type, workdir, resolution")
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ chamados: data });
}

export async function POST(req: Request) {
  const { id, decision } = await req.json();
  if (!id || !["approve", "reject"].includes(decision)) {
    return Response.json({ error: "id e decision (approve|reject) obrigatórios" }, { status: 400 });
  }
  const { data: card } = await sb()
    .from("dev_backlog")
    .select("id, request, status")
    .eq("id", id)
    .eq("status", "built")
    .maybeSingle();
  if (!card) return Response.json({ error: "chamado não está aguardando decisão" }, { status: 404 });

  const status = decision === "approve" ? "approved" : "rejected";
  await sb().from("dev_backlog").update({ status }).eq("id", id);
  await auditEvent("cris", `chamado_${status}`, { id, request: card.request }, decision === "approve");
  return Response.json({ ok: true, status });
}
