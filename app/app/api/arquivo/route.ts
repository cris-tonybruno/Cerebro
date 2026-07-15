import { sb } from "@/lib/supabase";

// Arquivo: custo do mês traduzido em dinheiro (por assento) + conversas salvas
// etiquetadas pelo protocolo que estava ativo (mockup do Cris).

const USD_TO_CAD = Number(process.env.USD_TO_CAD ?? 1.37);

export async function GET() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const [usageRes, turnsRes] = await Promise.all([
    sb().from("api_usage").select("purpose, cost_usd").gte("created_at", start.toISOString()),
    sb()
      .from("turns")
      .select("session_id, created_at, role, content, active_protocols, route, modality")
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  // ── custo por assento ──
  const buckets: Record<string, number> = { principal: 0, conselho: 0, voz: 0, memoria: 0 };
  for (const r of usageRes.data ?? []) {
    const cad = Number(r.cost_usd) * USD_TO_CAD;
    if (r.purpose === "council") buckets.conselho += cad;
    else if (r.purpose === "stt" || r.purpose === "tts") buckets.voz += cad;
    else if (r.purpose?.includes("embed") || r.purpose === "memory_write" || r.purpose === "recall" || r.purpose === "chat_query" || r.purpose === "chat_persist" || r.purpose === "vision_lessons" || r.purpose === "research_archive" || r.purpose === "council_context")
      buckets.memoria += cad;
    else buckets.principal += cad;
  }
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);

  // ── conversas (sessões) ──
  type Sess = {
    session_id: string;
    started: string;
    title: string;
    protocols: Set<string>;
    conselho: boolean;
    voz: boolean;
    turnos: number;
  };
  const map = new Map<string, Sess>();
  for (const t of (turnsRes.data ?? []).reverse()) {
    let s = map.get(t.session_id);
    if (!s) {
      s = {
        session_id: t.session_id,
        started: t.created_at,
        title: "",
        protocols: new Set(),
        conselho: false,
        voz: false,
        turnos: 0,
      };
      map.set(t.session_id, s);
    }
    if (t.role === "cris") {
      s.turnos++;
      if (!s.title) s.title = t.content.slice(0, 70);
      if (t.modality === "voice") s.voz = true;
    }
    for (const p of t.active_protocols ?? []) s.protocols.add(p);
    if (t.route === "council") s.conselho = true;
  }
  const sessions = [...map.values()]
    .sort((a, b) => (a.started < b.started ? 1 : -1))
    .slice(0, 25)
    .map((s) => ({
      ...s,
      protocols: [...s.protocols],
    }));

  return Response.json({
    total_cad: total,
    budget_cad: Number(process.env.MONTHLY_BUDGET_CAD ?? 50),
    assentos: buckets,
    sessions,
  });
}
