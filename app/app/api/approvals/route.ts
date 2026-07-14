import { sb } from "@/lib/supabase";
import { executeTool } from "@/lib/tools";
import { auditEvent } from "@/lib/security";

// M8 — Approval cards: a IA prepara, o Cris aprova (princípio de ouro §15).

export const maxDuration = 120;

export async function GET() {
  const { data, error } = await sb()
    .from("approvals")
    .select("id, created_at, action, summary, status, result")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ approvals: data });
}

// Decisão do Cris: aprovar executa a ação preparada; negar arquiva.
export async function POST(req: Request) {
  const { id, decision } = await req.json();
  if (!id || !["approved", "denied"].includes(decision)) {
    return Response.json({ error: "id e decision (approved|denied) obrigatórios" }, { status: 400 });
  }

  const { data: card } = await sb()
    .from("approvals")
    .select("id, action, summary, detail, status")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (!card) return Response.json({ error: "card não encontrado ou já decidido" }, { status: 404 });

  let result: string | null = null;
  if (decision === "approved" && card.detail?.tool) {
    result = await executeTool(
      String(card.detail.tool),
      (card.detail.input as Record<string, unknown>) ?? {},
      (card.detail.ctx as Record<string, unknown>) ?? {},
      true // bypass: já aprovado pelo Cris
    );
  }

  await sb()
    .from("approvals")
    .update({ status: decision, decided_at: new Date().toISOString(), result })
    .eq("id", id);

  await auditEvent("cris", `approval_${decision}`, { action: card.action, summary: card.summary }, decision === "approved");

  return Response.json({ ok: true, result });
}
