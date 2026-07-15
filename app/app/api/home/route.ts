import { sb } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/geo";
import { monthUsage } from "@/lib/costs";
import { listProtocols } from "@/lib/protocols";
import { getFocusedProject } from "@/lib/projects";

// Bundle da tela de repouso: lugar, temperatura, custo, protocolos ativos, projeto em foco.
export async function GET() {
  const [loc, usage, protocols, project] = await Promise.all([
    getCurrentLocation(),
    monthUsage(),
    listProtocols(),
    getFocusedProject(),
  ]);

  let tempC: number | null = null;
  if (loc) {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=temperature_2m&timezone=auto`,
        { signal: AbortSignal.timeout(5000) }
      );
      const json = await res.json();
      tempC = Math.round(json.current?.temperature_2m ?? NaN) || null;
    } catch {
      /* sem clima, sem drama */
    }
  }

  const { count: builtWaiting } = await sb()
    .from("dev_backlog")
    .select("id", { count: "exact", head: true })
    .eq("status", "built");

  return Response.json({
    place: loc?.place_label ?? null,
    tempC,
    month_cad: usage.month_cad,
    budget_cad: usage.budget_cad,
    pct: usage.pct,
    activeProtocols: protocols.filter((p) => p.active).map((p) => p.name),
    project: project ? { name: project.name } : null,
    aguardando_decisao: builtWaiting ?? 0,
  });
}
